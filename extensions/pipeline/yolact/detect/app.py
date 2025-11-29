import numpy as np
import torch
import cv2
import boto3
import logging
from yolact_cpu.data.config import Config
from yolact_cpu.yolact import Yolact
from yolact_cpu.eval import Detections
from yolact_cpu.utils.augmentations import FastBaseTransform
from yolact_cpu.layers.output_utils import postprocess
from io import BytesIO
from typing import TypedDict, List, Dict
from operator import itemgetter
from pathlib import Path
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
s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")


# TODO: https://www.reddit.com/r/aws/comments/17qn3ez/comment/k8ig17t/
def detection(event: EventData) -> list[Response]:

    assert "payload" in event, "Missing payload"

    print(f"Got payload: {event['payload']}")
    pk, prev_sk, media_id, media_bucket, media_key = itemgetter(
        "pk", "sk", "media_id", "bucket", "key"
    )(event["payload"])

    expires = event["expires"]

    media_path = Path(media_key)
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

    transact_items = [
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
        }
    ]

    for i in range(masks.shape[0]):
        detection = Detections(config, media_bucket + "/" + media_key)

        # Make sure that the bounding box actually makes sense and a mask was produced
        if (boxes[i, 3] - boxes[i, 1]) * (boxes[i, 2] - boxes[i, 0]) > 0:
            detection.add_bbox(i, classes[i], boxes[i, :], scores[i])
            detection.add_poly(i, classes[i], masks[i, :, :], scores[i])

        img_masked = mask_image_feathered(img, detection.mask_data["segmentation"])
        is_success, buffer = cv2.imencode(".jpg", img_masked)
        if not is_success:
            raise ValueError("Unable to imencode()")
        result = BytesIO(buffer.tobytes()).getvalue()

        # put results on s3
        (image_result_bucket, image_result_key) = (
            environ["BUCKET"],
            (
                f"{media_path.parent}/{media_id}/{i}.jpg"
                if str(media_path.parent).startswith("_assets/temp")
                else f"_assets/pending/{pk}/{media_id}/{i}.jpg"
            ),
        )

        print(f"Storing detection in s3:{image_result_bucket}/{image_result_key}")
        s3.put_object(
            Body=result,
            ContentType="image/jpeg",
            Bucket=image_result_bucket,
            Key=image_result_key,
            Metadata={
                "type": "yolact",
                "model": model_key,
            },
        )

        # put results on dynamo
        sk = f"detection#{media_id}#{i}#yolact"
        print(f"Storing detection in dynamo:{pk}/{sk}")
        result = detection.serialize()

        expr_names = {
            "#MEDIAID": "media_id",
            "#DETECTIONID": "detection_id",
            "#TYPE": "type",
            "#CATEGORY": "category",
            "#DATA": "data",
            "#SCORE": "score",
            "#URI": "uri",
            "#CREATEDAT": "created_at",
            "#GSI1PK": "gsi1pk",
        }
        expr_values = {
            ":mediaid": {"S": media_id},
            ":detectionid": {"S": str(i)},
            ":type": {"S": "yolact"},
            ":category": result["category"],
            ":data": result["data"],
            ":score": result["score"],
            ":uri": {
                "M": {
                    "bucket": {"S": image_result_bucket},
                    "key": {"S": image_result_key},
                }
            },
            ":createdat": {
                "S": datetime.now(UTC)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            },
            ":gsi1pk": {"S": "result"},
        }
        update_expr = [
            "#MEDIAID = :mediaid",
            "#DETECTIONID = :detectionid",
            "#TYPE = :type",
            "#CATEGORY = :category",
            "#DATA = :data",
            "#SCORE = :score",
            "#URI = :uri",
            "#CREATEDAT = :createdat",
            "#GSI1PK = :gsi1pk",
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
                "bucket": image_result_bucket,
                "key": image_result_key,
            }
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


def mask_image(img, segs):
    img_masked = img
    if segs is not None:
        mask = np.zeros(img_masked.shape, dtype=np.uint8)
        for seg in segs:
            poly = np.array(list(zip(seg[0::2], seg[1::2])), dtype=np.int32)
            cv2.fillPoly(mask, [poly], (1, 1, 1))
        img_masked = (img_masked * mask).clip(0, 255).astype(np.uint8)
    return img_masked


def mask_image_feathered(img, segs, fade_width=50, blur_kernel=31):
    """
    Create a soft feathered edge that fades the image into the average color of the subject.

    Args:
        img (numpy.ndarray): Original image
        segs (list): List of segmentation segments, where each segment is [x1, y1, x2, y2, ...]
        fade_width (int): Width of the feather boundary in pixels (larger values = more gradual transitions)
        blur_kernel (int): Kernel size for Gaussian blur to further soften edges

    Returns:
        numpy.ndarray: Masked image with feathered edges to average color
    """
    if segs is None or len(segs) == 0:
        return img

    # Create binary mask
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    for seg in segs:
        poly = np.array(list(zip(seg[0::2], seg[1::2])), dtype=np.int32)
        cv2.fillPoly(mask, [poly], (255,))

    # Calculate average color of the subject
    subject_mask = mask > 0
    if np.sum(subject_mask) > 0:
        avg_color = np.mean(img[subject_mask], axis=0).astype(np.uint8)
    else:
        avg_color = np.array([128, 128, 128])  # Fallback to gray if no object is found

    # Create background with average color
    background = np.ones_like(img) * avg_color.reshape(1, 1, 3)

    # Calculate distance transform for feathering
    dist_transform = cv2.distanceTransform(255 - mask, cv2.DIST_L2, 5)
    dist_transform = np.clip(dist_transform, 0, fade_width) / fade_width

    # Create feathered transition mask (linear feathering)
    feather_mask = 1 - dist_transform
    feather_mask = np.clip(feather_mask, 0, 1)

    # Apply Gaussian blur for smooth feathered edges
    feather_mask = cv2.GaussianBlur(feather_mask, (blur_kernel, blur_kernel), 0)
    feather_mask = np.repeat(feather_mask[:, :, np.newaxis], 3, axis=2)

    # Blend the image with the average color background using feathered mask
    result = img * feather_mask + background * (1 - feather_mask)

    return result.astype(np.uint8)
