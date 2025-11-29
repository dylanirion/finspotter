import json
import numpy as np
import cv2
import boto3
import logging
from os import environ
from base64 import urlsafe_b64decode
from operator import itemgetter
from pathlib import Path
from typing import TypedDict
from boto3.dynamodb.types import TypeDeserializer
from datetime import datetime, UTC


class S3Object(TypedDict):
    bucket: str
    key: str


class DynamoItem(TypedDict):
    pk: str
    sk: str


class HomogConfig(TypedDict):
    ransacReprojThreshold: float


class Payload(S3Object, DynamoItem):
    pass


class EventData(TypedDict):
    submissionId: str
    index: int
    payload: Payload
    config: HomogConfig
    expires: int


Match = TypedDict("Match", {"from": int, "to": int, "distance": float})

HOMOG_PARAMS: HomogConfig = {"ransacReprojThreshold": 3}

logging.getLogger("botocore").setLevel(logging.INFO)
s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")
deserializer = TypeDeserializer()


def homography(event) -> Payload:

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

    # TODO: is it faster to look this up from matchset key?
    a_encoded, b_encoded = matchset_path.stem.split("-")
    a_media_id, a_detection_id = decode_id(a_encoded)
    b_media_id, b_detection_id = decode_id(b_encoded)

    a_keypoints_response = dynamodb.query(
        TableName=environ["TABLE"],
        ExpressionAttributeValues={
            ":pk": {"S": pk},
            ":sk_prefix": {
                "S": f"extraction#{a_media_id}#{a_detection_id}"  # TODO: where will existing keypoint features be stored?
            },
        },
        KeyConditionExpression="pk = :pk AND begins_with(sk, :sk_prefix)",
        ProjectionExpression="uri.keypoints",
    )
    a_keypoints_uri = deserializer.deserialize(a_keypoints_response["Items"][0]["uri"])[
        "keypoints"
    ]
    print(
        f"Downloading keypoints from {a_keypoints_uri["bucket"]}/{a_keypoints_uri["key"]}"
    )
    keypoints_a = np.array(
        [
            [pt[0], pt[1]]
            for pt in get_object(
                bucket=a_keypoints_uri["bucket"],
                key=a_keypoints_uri["key"],
            )
        ],
        dtype=np.float32,
    )

    b_keypoints_response = dynamodb.query(
        TableName=environ["TABLE"],
        ExpressionAttributeValues={
            ":pk": {"S": pk},
            ":sk_prefix": {"S": f"extraction#{b_media_id}#{b_detection_id}"},
        },
        KeyConditionExpression="pk = :pk AND begins_with(sk, :sk_prefix)",
        ProjectionExpression="uri.keypoints",
    )
    b_keypoints_uri = deserializer.deserialize(b_keypoints_response["Items"][0]["uri"])[
        "keypoints"
    ]

    print(
        f"Downloading keypoints from {b_keypoints_uri["bucket"]}/{b_keypoints_uri["key"]}"
    )
    keypoints_b = np.array(
        [
            [pt[0], pt[1]]
            for pt in get_object(
                bucket=b_keypoints_uri["bucket"],
                key=b_keypoints_uri["key"],
            )
        ],
        dtype=np.float32,
    )

    src_pts = np.float32([keypoints_a[m["from"]] for m in matches]).reshape(-1, 1, 2)
    dst_pts = np.float32([keypoints_b[m["to"]] for m in matches]).reshape(-1, 1, 2)

    # Use RANSAC to estimate the homography matrix. mask contains the list of inliers
    # TODO: may need to check for minimum pts
    H, mask = cv2.findHomography(
        src_pts, dst_pts, cv2.RANSAC, cfg["ransacReprojThreshold"]
    )
    # TODO: return H somehow?

    inlier_matches = (
        [] if mask is None else [m for m, keep in zip(matches, mask.ravel()) if keep]
    )
    print(f"Homography refined {len(matches)} matches to {len(inlier_matches)}")

    # put result on s3
    (refine_result_bucket, refine_result_key) = (
        environ["BUCKET"],
        f"{str(matchset_path.parent.parent)}/homog/{matchset_path.stem}.json",
    )
    print(f"Storing refinement in {refine_result_bucket}/{refine_result_key}")
    s3.put_object(
        Body=json.dumps(inlier_matches),
        Bucket=refine_result_bucket,
        Key=refine_result_key,
        Metadata={
            "type": "homog",
        },
    )

    # put results on dynamo
    type = prev_sk.split("#")[1]
    sk = f"search#{type}#{a_media_id}#{a_detection_id}#{b_media_id}#{b_detection_id}#{index}#homog"
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
                            "S": "homog",
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
                },
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
    return homography(event)


def get_object(bucket: str, key: str) -> list:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj["Body"].read())


def get_config(event: EventData) -> HomogConfig:
    cfg = event["config"] if "config" in event else None

    if cfg is not None:
        cfg = HOMOG_PARAMS | cfg
    else:
        cfg = HOMOG_PARAMS

    return cfg


def decode_id(encoded) -> list[str]:
    padded = encoded + "=" * (-len(encoded) % 4)  # pad to valid length
    return urlsafe_b64decode(padded).decode().split("|")
