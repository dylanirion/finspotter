import hashlib
import json
from datetime import UTC, datetime
from os import environ
from typing import NotRequired, TypedDict, cast

import cv2
import numpy as np
from client import get_client, require_object_payload


class AffineTransform(TypedDict):
    a: float
    b: float
    c: float
    d: float
    e: float
    f: float


class Mask(TypedDict):
    polygons: list[list[float]]
    featherPixels: float


class MaterializationPlan(TypedDict):
    sourceToDerived: AffineTransform
    width: float
    height: float
    mask: NotRequired[Mask]


class AutoReview(TypedDict):
    annotationId: str
    reviewedBy: str
    reviewedAt: str


class Payload(TypedDict):
    pk: str
    sk: str
    media_id: str
    detection_id: str
    bucket: str
    key: str
    materialization: MaterializationPlan
    autoReview: NotRequired[AutoReview]


class Event(TypedDict):
    submissionId: str
    payload: Payload
    expires: int | None


s3 = get_client("s3")
dynamodb = get_client("dynamodb")
PAYLOAD_KEYS = (
    "pk",
    "sk",
    "media_id",
    "detection_id",
    "bucket",
    "key",
    "materialization",
)


def lambda_handler(event: Event, context):
    payload = cast(Payload, require_object_payload(event, PAYLOAD_KEYS))
    source = s3.get_object(Bucket=payload["bucket"], Key=payload["key"])
    image = cv2.imdecode(np.frombuffer(source["Body"].read(), np.uint8), 1)
    if image is None:
        raise ValueError("Unable to decode source image")

    plan = payload["materialization"]
    width = max(1, round(plan["width"]))
    height = max(1, round(plan["height"]))
    source_to_derived = affine_matrix(plan["sourceToDerived"])
    derived_to_source = cv2.invertAffineTransform(source_to_derived)
    background = average_subject_color(image, plan.get("mask"))
    materialized = cv2.warpAffine(
        image,
        source_to_derived,
        (width, height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=tuple(int(value) for value in background),
    )

    mask = plan.get("mask")
    if mask is not None:
        materialized = apply_mask(
            materialized,
            image.shape[:2],
            source_to_derived,
            mask,
            background,
        )

    encoded, buffer = cv2.imencode(".jpg", materialized)
    if not encoded:
        raise ValueError("Unable to encode materialized image")

    version = hashlib.sha256(
        json.dumps(
            {"source": payload["sk"], "plan": plan},
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()[:16]
    output_key = (
        f"pending/{payload['pk']}/{payload['media_id']}/"
        f"{payload['detection_id']}/materialized-{version}.jpg"
    )
    output_bucket = environ["BUCKET"]
    s3.put_object(
        Bucket=output_bucket,
        Key=output_key,
        Body=buffer.tobytes(),
        ContentType="image/jpeg",
        Metadata={"type": "annotation-materialization"},
    )

    mapping = {
        "source_to_derived": matrix_value(source_to_derived),
        "derived_to_source": matrix_value(derived_to_source),
        "source": {"width": image.shape[1], "height": image.shape[0]},
        "derived": {"width": width, "height": height},
    }
    dynamodb.update_item(
        TableName=environ["TABLE"],
        Key={"pk": {"S": payload["pk"]}, "sk": {"S": payload["sk"]}},
        ExpressionAttributeNames={
            "#URI": "uri",
            "#SOURCEURI": "source_uri",
            "#MAPPING": "coordinate_mapping",
            "#MATERIALIZEDAT": "materialized_at",
        },
        ExpressionAttributeValues={
            ":uri": {
                "M": {
                    "bucket": {"S": output_bucket},
                    "key": {"S": output_key},
                }
            },
            ":sourceuri": {
                "M": {
                    "bucket": {"S": payload["bucket"]},
                    "key": {"S": payload["key"]},
                }
            },
            ":mapping": dynamo_mapping(mapping),
            ":materializedat": {
                "S": datetime.now(UTC)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            },
        },
        UpdateExpression=(
            "SET #URI = :uri, #SOURCEURI = :sourceuri, #MAPPING = :mapping, "
            "#MATERIALIZEDAT = :materializedat"
        ),
    )

    return {
        **payload,
        "bucket": output_bucket,
        "key": output_key,
        "coordinate_mapping": mapping,
    }


def affine_matrix(transform: AffineTransform) -> np.ndarray:
    return np.array(
        [
            [transform["a"], transform["c"], transform["e"]],
            [transform["b"], transform["d"], transform["f"]],
        ],
        dtype=np.float64,
    )


def polygon_mask(shape: tuple[int, int], polygons: list[list[float]]) -> np.ndarray:
    mask = np.zeros(shape, dtype=np.uint8)
    for polygon in polygons:
        points = np.array(polygon, dtype=np.float64).reshape((-1, 2))
        if len(points) >= 3:
            cv2.fillPoly(mask, [np.rint(points).astype(np.int32)], 255)
    return mask


def average_subject_color(image: np.ndarray, mask: Mask | None) -> np.ndarray:
    if mask is None:
        return np.mean(image.reshape((-1, 3)), axis=0)
    source_mask = polygon_mask(image.shape[:2], mask["polygons"])
    subject = image[source_mask > 0]
    return np.mean(subject, axis=0) if len(subject) else np.array([128, 128, 128])


def apply_mask(
    image: np.ndarray,
    source_shape: tuple[int, int],
    source_to_derived: np.ndarray,
    mask: Mask,
    background_color: np.ndarray,
) -> np.ndarray:
    source_mask = polygon_mask(source_shape, mask["polygons"])
    derived_mask = cv2.warpAffine(
        source_mask,
        source_to_derived,
        (image.shape[1], image.shape[0]),
        flags=cv2.INTER_NEAREST,
    )
    feather_pixels = max(0.0, mask.get("featherPixels", 0.0))
    if feather_pixels > 0:
        distance = cv2.distanceTransform(255 - derived_mask, cv2.DIST_L2, 5)
        alpha = 1 - np.clip(distance, 0, feather_pixels) / feather_pixels
        kernel = max(3, round(feather_pixels * 0.6) | 1)
        alpha = cv2.GaussianBlur(alpha, (kernel, kernel), 0)
    else:
        alpha = derived_mask.astype(np.float64) / 255
    alpha = np.repeat(alpha[:, :, np.newaxis], 3, axis=2)
    background = np.ones_like(image) * background_color.reshape((1, 1, 3))
    return (image * alpha + background * (1 - alpha)).clip(0, 255).astype(np.uint8)


def matrix_value(matrix: np.ndarray) -> dict[str, float]:
    return {
        "a": float(matrix[0, 0]),
        "b": float(matrix[1, 0]),
        "c": float(matrix[0, 1]),
        "d": float(matrix[1, 1]),
        "e": float(matrix[0, 2]),
        "f": float(matrix[1, 2]),
    }


def dynamo_mapping(mapping: dict) -> dict:
    return {
        "M": {
            "source_to_derived": affine_dynamo(mapping["source_to_derived"]),
            "derived_to_source": affine_dynamo(mapping["derived_to_source"]),
            "source": dimensions_dynamo(mapping["source"]),
            "derived": dimensions_dynamo(mapping["derived"]),
        }
    }


def affine_dynamo(transform: dict[str, float]) -> dict:
    return {"M": {key: {"N": str(value)} for key, value in transform.items()}}


def dimensions_dynamo(dimensions: dict[str, int]) -> dict:
    return {"M": {key: {"N": str(value)} for key, value in dimensions.items()}}
