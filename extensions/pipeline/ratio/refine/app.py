import json
import boto3
import logging
from os import environ
from base64 import urlsafe_b64decode
from operator import itemgetter
from pathlib import Path
from typing import TypedDict
from collections import defaultdict
from datetime import datetime, UTC


class S3Object(TypedDict):
    bucket: str
    key: str


class DynamoItem(TypedDict):
    pk: str
    sk: str


class RatioConfig(TypedDict):
    threshold: float


class Payload(S3Object, DynamoItem):
    pass


class EventData(TypedDict):
    submissionId: str
    index: int
    payload: Payload
    config: RatioConfig
    expires: int


Match = TypedDict("Match", {"from": int, "to": int, "distance": float})

RATIO_PARAMS: RatioConfig = {"threshold": 0.625}

logging.getLogger("botocore").setLevel(logging.INFO)
s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")


def ratio_test(event) -> Payload:

    assert "payload" in event, "Missing payload"

    index = event["index"]
    expires = event["expires"]

    print(f"Got payload: {event['payload']}")
    pk, prev_sk, matchset_bucket, matchset_key = itemgetter(
        "pk", "sk", "bucket", "key"
    )(event["payload"])
    matchset_path = Path(
        matchset_key
    )  # {...}/{pipeline_id}/{}/{a_image_id}_{a_detection_id}-{b_image_id}_{b_detection_id}.json"
    cfg = get_config(event)

    # TODO: Validate Content-Type from S3?
    print(f"Downloading matches from {matchset_bucket}/{matchset_key}")
    matches: list[Match] = get_object(bucket=matchset_bucket, key=matchset_key)

    grouped = defaultdict(list)

    for match in matches:
        grouped[match["from"]].append(match)

    refined = []
    for group in grouped.values():
        if len(group) >= 2:
            first, second = sorted(group, key=lambda m: m["distance"])[:2]
            ratio = first["distance"] / second["distance"]
            score = 1.0 - ratio
            first["score"] = score
            if ratio < cfg["threshold"]:
                refined.append(first)
    print(f"Ratio test refined {len(grouped)} matches to {len(refined)}")

    # put result on s3
    (refine_result_bucket, refine_result_key) = (
        environ["BUCKET"],
        f"{str(matchset_path.parent.parent)}/ratio/{matchset_path.stem}.json",
    )
    print(f"Storing refinement in {refine_result_bucket}/{refine_result_key}")
    s3.put_object(
        Body=json.dumps(refined),
        Bucket=refine_result_bucket,
        Key=refine_result_key,
        Metadata={
            "type": "ratio",
        },
    )

    # put results on dynamo
    a_encoded, b_encoded = matchset_path.stem.split("-")
    a_media_id, a_detection_id = decode_id(a_encoded)
    b_media_id, b_detection_id = decode_id(b_encoded)
    type = prev_sk.split("#")[1]
    sk = f"search#{type}#{a_media_id}#{a_detection_id}#{b_media_id}#{b_detection_id}#{index}#ratio"
    print(f"Storing refinement result in dynamo:{pk}/{sk}")
    update_expr = [
        "#QUERY = :query",
        "#REF = :ref",
        "#INDEX = :index",
        "#TYPE = :type",
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
                            "S": pk,
                        },
                        "sk": {
                            "S": prev_sk,
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
                                    "S": a_media_id,
                                },
                                "detection_id": {
                                    "S": a_detection_id,
                                },
                            },
                        },
                        ":ref": {
                            "M": {
                                "media_id": {
                                    "S": b_media_id,
                                },
                                "detection_id": {
                                    "S": b_detection_id,
                                },
                            },
                        },
                        ":type": {
                            "S": "ratio",
                        },
                        ":index": {
                            "N": str(index + 1),
                        },
                        ":uri": {
                            "M": {
                                "bucket": {"S": refine_result_bucket},
                                "key": {"S": refine_result_key},
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
        "bucket": refine_result_bucket,
        "key": refine_result_key,
    }


def lambda_handler(event, context):
    return ratio_test(event)


def get_object(bucket: str, key: str) -> list:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj["Body"].read())


def get_config(event: EventData) -> RatioConfig:
    cfg = event["config"] if "config" in event else None

    if cfg is not None:
        cfg = RATIO_PARAMS | cfg
    else:
        cfg = RATIO_PARAMS

    return cfg


def decode_id(encoded) -> list[str]:
    padded = encoded + "=" * (-len(encoded) % 4)  # pad to valid length
    return urlsafe_b64decode(padded).decode().split("|")
