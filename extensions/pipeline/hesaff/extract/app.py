import json
import numpy as np
import cv2
import boto3
import pyhesaff
import logging
from os import environ
from operator import itemgetter
from pathlib import Path
from typing import TypedDict
from datetime import datetime, UTC


class S3Object(TypedDict):
    bucket: str
    key: str


class DynamoItem(TypedDict):
    pk: str
    sk: str


class HesaffConfig(TypedDict):
    numberOfScales: int
    threshold: float
    edgeEigenValueRatio: float
    border: int
    maxPyramidLevels: int
    maxIterations: int
    convergenceThreshold: float
    smmWindowSize: int
    mrSize: float
    spatialBins: int
    orientationBins: int
    maxBinValue: float
    initialSigma: float
    patchSize: int
    scale_min: float
    scale_max: float
    rotation_invariance: bool
    augment_orientation: bool
    ori_maxima_thresh: float
    affine_invariance: bool
    only_count: bool
    use_dense: bool
    dense_stride: int
    siftPower: float


class Payload(S3Object, DynamoItem):
    media_id: str
    detection_id: str


class EventData(TypedDict):
    submissionId: str
    expires: str
    payload: Payload
    config: HesaffConfig


HESAFF_PARAMS: HesaffConfig = {
    "numberOfScales": 3,  # number of scales per octave
    "threshold": 16.0 / 3.0,  # noise dependent threshold on the response (sensitivity)
    "edgeEigenValueRatio": 10.0,  # ratio of the eigenvalues
    "border": 5,  # number of pixels ignored at the border of image
    "maxPyramidLevels": -1,  # maximum number of pyramid divisions. -1 is no limit
    # Affine Shape Params
    "maxIterations": 16,  # number of affine shape iterations
    "convergenceThreshold": 0.05,  # maximum deviation from isotropic shape at convergence
    "smmWindowSize": 19,  # width and height of the SMM (second moment matrix) mask
    "mrSize": 3.0
    * np.sqrt(3.0),  # size of the measurement region (as multiple of the feature scale)
    # SIFT params
    "spatialBins": 4,
    "orientationBins": 8,
    "maxBinValue": 0.2,
    # Shared params
    "initialSigma": 1.6,  # amount of smoothing applied to the initial level of first octave
    "patchSize": 41,  # width and height of the patch
    # My params
    "scale_min": -1.0,
    "scale_max": -1.0,
    "rotation_invariance": False,
    "augment_orientation": False,
    "ori_maxima_thresh": 0.8,
    "affine_invariance": True,
    "only_count": False,
    #
    "use_dense": False,
    "dense_stride": 32,
    "siftPower": 1.0,
}

logging.getLogger("botocore").setLevel(logging.INFO)
s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")


def extraction(event: EventData) -> Payload:

    assert "payload" in event, "Missing payload"

    print(f"Got payload: {event['payload']}")
    pk, prev_sk, media_id, detection_id, detection_bucket, detection_key = itemgetter(
        "pk", "sk", "media_id", "detection_id", "bucket", "key"
    )(event["payload"])

    expires = event["expires"]

    detection_path = Path(detection_key)
    cfg = get_config(event)

    # TODO: Validate Content-Type from S3?
    print(f"Downloading image from {detection_bucket}/{detection_key}")
    object = s3.get_object(Bucket=detection_bucket, Key=detection_key)
    print(f"Decoding {object['ContentType']} from {detection_bucket}/{detection_key}")
    img = cv2.imdecode(np.frombuffer(object["Body"].read(), np.uint8), 1)

    # TODO: from config
    # min_frac = 0.1 # if subject covers less than min_frac, increase towards scale_max
    # max_frac = 0.5 # if subect covers more than max_frac, decrease towards base_min
    # base_min = 3.0 # lowest scale allowed
    # max_scale = 30.0
    # height, width = img.shape[:2]
    # foreground_frac = np.count_nonzero(img) / (height * width)

    # Compute dynamic scale min
    # scale_boost = np.clip(1.0 - (foreground_frac - min_frac) / (max_frac - min_frac), 0.0, 1.0)
    # scale_min = base_min + scale_boost * (max_scale - base_min)
    # cfg["scale_min"] = scale_min

    kpts, vecs = pyhesaff.detect_feats_in_image(img, **cfg)
    print(f"Extracted {len(vecs)}")

    # put result on s3
    (features_result_bucket, features_result_key) = (
        environ["BUCKET"],
        f"{str(detection_path.parent)}/{detection_id}/features.json",
    )
    print(f"Storing features in s3:{features_result_bucket}/{features_result_key}")
    s3.put_object(
        Body=json.dumps(
            vecs.tolist(),
        ),
        Bucket=features_result_bucket,
        Key=features_result_key,
        Metadata={
            "type": "hesaff",
        },
    )
    (keypoints_result_bucket, keypoints_result_key) = (
        environ["BUCKET"],
        f"{str(detection_path.parent)}/{detection_id}/keypoints.json",
    )
    print(f"Storing keypoints in s3:{keypoints_result_bucket}/{keypoints_result_key}")
    s3.put_object(
        Body=json.dumps(kpts.tolist()),
        Bucket=keypoints_result_bucket,
        Key=keypoints_result_key,
        Metadata={
            "type": "hesaff",
        },
    )

    # put results on dynamo
    sk = f"extraction#{media_id}#{detection_id}#hesaff"
    print(f"Storing extraction in dynamo:{pk}/{sk}")
    update_expr = [
        "#MEDIAID = :mediaid",
        "#DETECTIONID = :detectionid",
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
                        "#MEDIAID": "media_id",
                        "#DETECTIONID": "detection_id",
                        "#TYPE": "type",
                        "#URI": "uri",
                        "#CREATEDAT": "created_at",
                        "#GSI1PK": "gsi1pk",
                        **({"#EXPIRES": "expires"} if expires is not None else {}),
                    },
                    "ExpressionAttributeValues": {
                        ":mediaid": {
                            "S": media_id,
                        },
                        ":detectionid": {
                            "S": detection_id,
                        },
                        ":type": {
                            "S": "hesaff",
                        },
                        ":uri": {
                            "M": {
                                "keypoints": {
                                    "M": {
                                        "bucket": {"S": keypoints_result_bucket},
                                        "key": {"S": keypoints_result_key},
                                    },
                                },
                                "features": {
                                    "M": {
                                        "bucket": {"S": features_result_bucket},
                                        "key": {"S": features_result_key},
                                    },
                                },
                            },
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
        "media_id": media_id,
        "detection_id": detection_id,
        "bucket": features_result_bucket,
        "key": features_result_key,
    }


def lambda_handler(event, context):
    return extraction(event)


def get_config(event: EventData) -> HesaffConfig:
    cfg = event["config"] if "config" in event else None

    if cfg is not None:
        cfg = HESAFF_PARAMS | cfg
    else:
        cfg = HESAFF_PARAMS

    return cfg
