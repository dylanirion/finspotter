import numpy as np
import torch
import cv2
import logging
from decimal import Decimal
from boto3.dynamodb.types import TypeSerializer
from client import get_client, require_object_payload
from yolact_cpu.data.config import Config
from yolact_cpu.yolact import Yolact
from yolact_cpu.eval import Detections
from yolact_cpu.utils.augmentations import FastBaseTransform
from yolact_cpu.layers.output_utils import postprocess
from io import BytesIO
from typing import TypedDict, List, Dict, cast
from operator import itemgetter
from os import environ
from datetime import datetime, UTC


class S3Object(TypedDict):
    bucket: str
    key: str


class DynamoItem(TypedDict):
    pk: str
    sk: str


class DatasetConfig(TypedDict):
    class_names: List[str]
    label_map: Dict[int, int]


class YolactConfig(TypedDict):
    dataset: DatasetConfig
    num_classes: int
    score_threshold: float


class EventConfig(YolactConfig):
    model: S3Object


class Payload(S3Object, DynamoItem):
    media_id: str


class EventData(TypedDict):
    submissionId: str
    expires: str
    payload: Payload
    config: EventConfig


class Response(Payload, DynamoItem):
    detection_id: str


YOLACT_PARAMS: YolactConfig = {
    "dataset": {
        "class_names": [],
        "label_map": {},
    },
    "num_classes": 1,
    "score_threshold": 0.5,
}

logging.getLogger("botocore").setLevel(logging.INFO)
s3 = get_client("s3")
dynamodb = get_client("dynamodb")
serializer = TypeSerializer()

PAYLOAD_KEYS = ("pk", "sk", "media_id", "bucket", "key")


# TODO: https://www.reddit.com/r/aws/comments/17qn3ez/comment/k8ig17t/
def detection(event: EventData) -> list[Response]:
    payload = cast(Payload, require_object_payload(event, PAYLOAD_KEYS))
    print(f"Got payload: {payload}")
    pk, prev_sk, media_id, media_bucket, media_key = itemgetter(
        *PAYLOAD_KEYS
    )(payload)

    expires = event["expires"]

    cfg = get_config(event)

    assert "model" in cfg, "Missing required property `model` in config."

    model_bucket, model_key = itemgetter("bucket", "key")(cfg["model"])
    model = BytesIO()
    print(f"Downloading model from {model_bucket}/{model_key}")
    s3.download_fileobj(model_bucket, model_key, model)
    model.seek(0)

    # TODO: Validate Content-Type from S3?
    print(f"Downloading image from {media_bucket}/{media_key}")
    object = s3.get_object(Bucket=media_bucket, Key=media_key)
    print(f"Decoding {object['ContentType']} from {media_bucket}/{media_key}")
    img = cv2.imdecode(np.frombuffer(object["Body"].read(), np.uint8), 1)

    h, w, _ = img.shape

    frame = torch.from_numpy(img).float()
    batch = FastBaseTransform()(frame.unsqueeze(0))

    config = Config(
        {
            "dataset": Config(cfg["dataset"]),
            "num_classes": cfg["num_classes"],
            "mask_dim": None,
        }
    )

    net = Yolact(config)
    net.load_weights(model)
    net.eval()
    preds = net(batch)
    classes, scores, boxes, masks = postprocess(
        preds, w, h, score_threshold=cfg["score_threshold"]
    )

    classes = list(classes.detach().numpy().astype(int))
    scores = list(scores.detach().numpy().astype(float))
    masks = masks.view(-1, h * w)

    boxes = boxes.detach().numpy()
    masks = masks.view(-1, h, w).detach().numpy()
    result_list: list[Response] = []

    transact_items = []

    for i in range(masks.shape[0]):
        detection = Detections(config, media_bucket + "/" + media_key)

        # Make sure that the bounding box actually makes sense and a mask was produced
        if (boxes[i, 3] - boxes[i, 1]) * (boxes[i, 2] - boxes[i, 0]) > 0:
            detection.add_bbox(i, classes[i], boxes[i, :], scores[i])
            detection.add_poly(i, classes[i], masks[i, :, :], scores[i])

        # put results on dynamo
        sk = f"detection#{media_id}#{i}#yolact"
        print(f"Storing detection in dynamo:{pk}/{sk}")
        materialization = polygon_materialization(
            detection.mask_data["segmentation"]
        )
        result = detection.serialize()

        expr_names = {
            "#MEDIAID": "media_id",
            "#DETECTIONID": "detection_id",
            "#TYPE": "type",
            "#ANNOTATIONTYPE": "annotation_type",
            "#CATEGORY": "category",
            "#DATA": "data",
            "#SCORE": "score",
            "#URI": "uri",
            "#CREATEDAT": "created_at",
            "#GSI1PK": "gsi1pk",
            "#SOURCEMEDIA": "source_media",
            "#MATERIALIZATION": "materialization",
        }
        expr_values = {
            ":mediaid": {"S": media_id},
            ":detectionid": {"S": str(i)},
            ":type": {"S": "yolact"},
            ":annotationtype": {"S": "segmentation"},
            ":category": result["category"],
            ":data": result["data"],
            ":score": result["score"],
            ":uri": {
                "M": {
                    "bucket": {"S": media_bucket},
                    "key": {"S": media_key},
                }
            },
            ":createdat": {
                "S": datetime.now(UTC)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            },
            ":gsi1pk": {"S": "result"},
            ":sourcemedia": {
                "M": {
                    "pk": {"S": pk},
                    "sk": {"S": prev_sk},
                }
            },
            ":materialization": serializer.serialize(
                to_dynamo_value(materialization)
            ),
        }
        update_expr = [
            "#MEDIAID = :mediaid",
            "#DETECTIONID = :detectionid",
            "#TYPE = :type",
            "#ANNOTATIONTYPE = :annotationtype",
            "#CATEGORY = :category",
            "#DATA = :data",
            "#SCORE = :score",
            "#URI = :uri",
            "#CREATEDAT = :createdat",
            "#GSI1PK = :gsi1pk",
            "#SOURCEMEDIA = :sourcemedia",
            "#MATERIALIZATION = :materialization",
        ]
        if expires is not None:
            expr_names["#EXPIRES"] = "expires"
            expr_values[":expires"] = {"N": str(expires)}
            update_expr.append("#EXPIRES = :expires")
        transact_items.append(
            {
                "Update": {
                    "TableName": environ["TABLE"],
                    "Key": {"pk": {"S": pk}, "sk": {"S": sk}},
                    "ExpressionAttributeNames": expr_names,
                    "ExpressionAttributeValues": expr_values,
                    "UpdateExpression": "SET " + ", ".join(update_expr),
                }
            }
        )
        result_list.append(
            {
                "pk": pk,
                "sk": sk,
                "media_id": media_id,
                "detection_id": str(i),
                "bucket": media_bucket,
                "key": media_key,
                "materialization": materialization,
            }
        )

    if result_list:
        transact_items.insert(
            0,
            {
                "Update": {
                    "TableName": environ["TABLE"],
                    "Key": {"pk": {"S": pk}, "sk": {"S": prev_sk}},
                    "ExpressionAttributeNames": {
                        "#GSI1PK": "gsi1pk",
                        "#SUPERSEDEDBY": "superseded_by",
                    },
                    "ExpressionAttributeValues": {
                        ":supersededby": {"S": f"detection#{media_id}"},
                    },
                    "UpdateExpression": "REMOVE #GSI1PK SET #SUPERSEDEDBY = :supersededby",
                }
            },
        )
        dynamodb.transact_write_items(TransactItems=transact_items)
    return result_list


def lambda_handler(event, context):
    return detection(event)


def get_config(event: EventData) -> EventConfig:
    cfg = event["config"] if "config" in event else None

    if cfg is not None:
        cfg = YOLACT_PARAMS | cfg
    else:
        cfg = YOLACT_PARAMS | {"model": None}

    return cfg


def polygon_materialization(polygons: list[list[float]]) -> dict:
    points = [
        (polygon[index], polygon[index + 1])
        for polygon in polygons
        for index in range(0, len(polygon) - 1, 2)
    ]
    if not points:
        raise ValueError("Detection produced no materializable polygon")
    left = min(point[0] for point in points)
    top = min(point[1] for point in points)
    right = max(point[0] for point in points)
    bottom = max(point[1] for point in points)
    return {
        "sourceToDerived": {
            "a": 1,
            "b": 0,
            "c": 0,
            "d": 1,
            "e": -left,
            "f": -top,
        },
        "width": max(1, int(np.ceil(right - left))),
        "height": max(1, int(np.ceil(bottom - top))),
        "mask": {"polygons": polygons, "featherPixels": 50},
    }


def to_dynamo_value(value):
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [to_dynamo_value(item) for item in value]
    if isinstance(value, dict):
        return {key: to_dynamo_value(item) for key, item in value.items()}
    return value
