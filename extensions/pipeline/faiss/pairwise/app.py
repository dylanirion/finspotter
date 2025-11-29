from operator import itemgetter
import faiss
import numpy as np
import json
import boto3
import logging
from os import environ
from base64 import urlsafe_b64encode
from typing import TypedDict
from pathlib import Path
from datetime import datetime, UTC


class S3Object(TypedDict):
    bucket: str
    key: str


class DynamoItem(TypedDict):
    pk: str
    sk: str


class FaissConfig(TypedDict):
    index_string: str


class Payload(S3Object, DynamoItem):
    media_id: str
    detection_id: str


class EventData(TypedDict):
    submissionId: str
    expires: str
    payload: list[Payload]
    config: FaissConfig


class Response(S3Object, DynamoItem):
    pass


FAISS_PARAMS: FaissConfig = {
    "index_string": "Flat"  # https://github.com/facebookresearch/faiss/wiki/The-index-factory
}

logging.getLogger("botocore").setLevel(logging.INFO)
s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")


# FAISS guidelines
# <1M vectors https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index#if-below-1m-vectors-ivfk
# 1-10M vectors https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index#if-1m---10m-ivf65536_hnsw32
# 10-100M vectors https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index#if-10m---100m-ivf262144_hnsw32


def search(event: EventData) -> Response:

    assert "payload" in event, "Missing payload"

    submission_id = event["submissionId"]
    expires = event["expires"]

    cfg = get_config(event)
    payload = event["payload"]

    assert len(payload) == 2, "Expected payload length == 2"

    (a, b) = payload
    a_pk, a_sk, a_media_id, a_detection_id, a_bucket, a_key = itemgetter(
        "pk", "sk", "media_id", "detection_id", "bucket", "key"
    )(a)
    b_pk, b_sk, b_media_id, b_detection_id, b_bucket, b_key = itemgetter(
        "pk", "sk", "media_id", "detection_id", "bucket", "key"
    )(b)

    # TODO: Validate Content-Type from S3?
    print(f"Downloading features from {a_bucket}/{a_key}")
    features_a = get_object(bucket=a_bucket, key=a_key)
    print(f"Downloading features from {b_bucket}/{b_key}")
    features_b = get_object(bucket=b_bucket, key=b_key)

    if not features_a or not features_b:
        raise Exception("Missing features")

    print(
        f"Searching {len(features_a)} features from {a_bucket}/{a_key} in {len(features_b)} features from {b_bucket}/{b_key}"
    )

    array_a = np.array(features_a).astype("float32")
    array_b = np.array(features_b).astype("float32")

    # TODO condition on cfg?
    faiss.normalize_L2(array_a)
    faiss.normalize_L2(array_b)

    # may need to normalize depending on index?
    index_string = cfg["index_string"]
    index = faiss.index_factory(array_b.shape[1], index_string)
    if index.is_trained:
        index.train(array_b)
    index.add(array_b)
    print(f"Indexed {array_b.shape} features")

    distances, indices = index.search(array_a, k=2)
    print("Searching complete")
    # put result on s3
    # TODO: could this be a cache if we use a permanent key? key stems might need to be sorted, but only for non-symmetric
    root = Path(a_key).parent.parent.parent
    a_stem = (
        urlsafe_b64encode(f"{a_media_id}|{a_detection_id}".encode())
        .decode()
        .rstrip("=")
    )
    b_stem = (
        urlsafe_b64encode(f"{b_media_id}|{b_detection_id}".encode())
        .decode()
        .rstrip("=")
    )
    (matchset_result_bucket, matchset_result_key) = (
        environ["BUCKET"],
        f"{root}/faiss:pairwise/{a_stem}-{b_stem}.json",
    )
    print(f"Storing search result in s3:{matchset_result_bucket}/{matchset_result_key}")
    result = [
        {"from": i, "to": int(match_idx), "distance": float(dist)}
        for i, (row_idx, row_dist) in enumerate(zip(indices, distances))
        for match_idx, dist in zip(row_idx, row_dist)
    ]
    s3.put_object(
        Body=json.dumps(result),
        Bucket=matchset_result_bucket,
        Key=matchset_result_key,
        Metadata={
            "type": "faiss",
        },
    )

    # put results on dynamo
    pk = submission_id
    sk = f"search#pairwise#{a_media_id}#{a_detection_id}#{b_media_id}#{b_detection_id}#0#faiss"
    print(f"Storing search result in dynamo:{pk}/{sk}")
    update_expr = [
        "#QUERY = :query",
        "#REF = :ref",
        "#TYPE = :type",
        "#INDEX = :index",
        "#URI = :uri",
        "#CREATEDAT = :createdat",
        "#GSI1PK = :gsi1pk",
    ]
    if expires is not None:
        update_expr.append("#EXPIRES = :expires")
    dynamodb.transact_write_items(
        TransactItems=[
            {
                "Update": {
                    "TableName": environ["TABLE"],
                    "Key": {
                        "pk": {
                            "S": a_pk,
                        },
                        "sk": {
                            "S": a_sk,
                        },
                    },
                    "ExpressionAttributeNames": {
                        "#GSI1PK": "gsi1pk",
                        "#SUPERSEDEDBY": "superseded_by",
                    },
                    "ExpressionAttributeValues": {
                        ":supersededby": {
                            "S": sk,
                        },
                    },
                    "UpdateExpression": "REMOVE #GSI1PK SET #SUPERSEDEDBY = :supersededby",
                }
            },
            {
                "Update": {
                    "TableName": environ["TABLE"],
                    "Key": {
                        "pk": {
                            "S": b_pk,
                        },
                        "sk": {
                            "S": b_sk,
                        },
                    },
                    "ExpressionAttributeNames": {
                        "#GSI1PK": "gsi1pk",
                        "#SUPERSEDEDBY": "superseded_by",
                    },
                    "ExpressionAttributeValues": {
                        ":supersededby": {
                            "S": sk,
                        },
                    },
                    "UpdateExpression": "REMOVE #GSI1PK SET #SUPERSEDEDBY = :supersededby",
                }
            },
            {
                "Update": {
                    "TableName": environ["TABLE"],
                    "Key": {
                        "pk": {
                            "S": pk,
                        },
                        "sk": {
                            "S": sk,
                        },
                    },
                    "ExpressionAttributeNames": {
                        "#QUERY": "query",
                        "#REF": "ref",
                        "#INDEX": "index",
                        "#TYPE": "type",
                        "#URI": "uri",
                        "#CREATEDAT": "created_at",
                        "#GSI1PK": "gsi1pk",
                        **({"#EXPIRES": "expires"} if expires is not None else {}),
                    },
                    "ExpressionAttributeValues": {
                        ":query": {
                            "M": {
                                "media_id": {
                                    "S": a["media_id"],
                                },
                                "detection_id": {
                                    "S": a["detection_id"],
                                },
                            },
                        },
                        ":ref": {
                            "M": {
                                "media_id": {
                                    "S": b["media_id"],
                                },
                                "detection_id": {
                                    "S": b["detection_id"],
                                },
                            },
                        },
                        ":index": {
                            "N": "0",
                        },
                        ":type": {
                            "S": "faiss",
                        },
                        ":uri": {
                            "M": {
                                "bucket": {"S": matchset_result_bucket},
                                "key": {"S": matchset_result_key},
                            }
                        },
                        ":createdat": {
                            "S": datetime.now(UTC)
                            .isoformat(timespec="milliseconds")
                            .replace("+00:00", "Z")
                        },
                        ":gsi1pk": {"S": "result"},
                        **(
                            {":expires": {"N": str(expires)}}
                            if expires is not None
                            else {}
                        ),
                    },
                    "UpdateExpression": "SET " + ", ".join(update_expr),
                }
            },
        ]
    )

    return {
        "pk": pk,
        "sk": sk,
        "bucket": matchset_result_bucket,
        "key": matchset_result_key,
    }


def lambda_handler(event, context):
    return search(event)


def get_object(bucket: str, key: str) -> list:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj["Body"].read())


def get_config(event: EventData) -> FaissConfig:
    cfg = event["config"] if "config" in event else None

    if cfg is not None:
        cfg = FAISS_PARAMS | cfg
    else:
        cfg = FAISS_PARAMS

    return cfg
