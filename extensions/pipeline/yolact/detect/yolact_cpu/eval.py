from pycocotools import mask as cocomask
import numpy as np
import cv2
from boto3.dynamodb.types import TypeSerializer
from decimal import Decimal

coco_cats = {}  # Call prep_coco_cats to fill this
coco_cats_inv = {}
cfg = {}


def prep_coco_cats():
    """Prepare inverted table for category id lookup given a coco cats object."""
    for coco_cat_id, transformed_cat_id_p1 in cfg.dataset.label_map.items():
        transformed_cat_id = transformed_cat_id_p1 - 1
        coco_cats[transformed_cat_id] = coco_cat_id
        coco_cats_inv[coco_cat_id] = transformed_cat_id


def get_coco_cat(transformed_cat_id):
    return coco_cats[transformed_cat_id]


def get_transformed_cat(coco_cat_id):
    return coco_cats_inv[coco_cat_id]


class Detections:
    def __init__(self, config, file_name: str):
        global cfg
        cfg = config
        self.file_name = file_name
        prep_coco_cats()

    def add_bbox(self, id: int, category_id: int, bbox: list, score: float):
        """Note that bbox should be a list or tuple of (x1, y1, x2, y2)"""
        bbox = [bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]]

        # Round to the nearest 10th to avoid huge file sizes, as COCO suggests
        bbox = [round(float(x) * 10) / 10 for x in bbox]

        self.bbox_data = {
            "id": int(id),
            "category_id": get_coco_cat(int(category_id)),
            "bbox": bbox,
            "score": float(score),
        }

    def add_mask(
        self, id: int, category_id: int, segmentation: np.ndarray, score: float
    ):
        """
        The segmentation should be the full mask,
        the size of the image and with size [h, w].
        """
        rle = cocomask.encode(np.asfortranarray(segmentation.astype(np.uint8)))
        rle["counts"] = rle["counts"].decode(
            "ascii"
        )  # json.dump doesn't like bytes strings

        self.mask_data = {
            "id": int(id),
            "category_id": get_coco_cat(int(category_id)),
            "segmentation": rle,
            "score": float(score),
        }

    def add_poly(
        self, id: int, category_id: int, segmentation: np.ndarray, score: float
    ):
        contours, _ = cv2.findContours(
            (segmentation).astype(np.uint8),
            # cv2.RETR_LIST,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )
        _segmentation = []
        for contour in contours:
            # Valid polygons have >= 6 coordinates (3 points)
            if contour.size >= 6:
                # simplify polygon
                contour = cv2.approxPolyDP(
                    contour, 0.001 * cv2.arcLength(contour, True), True
                )
                _segmentation.append(contour.flatten().tolist())

        self.mask_data = {
            "id": int(id),
            "category_id": get_coco_cat(int(category_id)),
            "segmentation": _segmentation,
            "score": float(score),
        }

    def dump_coco(self):
        """
        Dumps it in coco format
        https://cocodataset.org/#format-data
        """
        output = {
            "image": {"file_name": self.file_name},
            "annotation": {
                "id": self.bbox_data["id"],
                "category_id": self.bbox_data["category_id"],
                "segmentation": self.mask_data["segmentation"],
                "bbox": self.bbox_data["bbox"],
                "score": self.mask_data["score"],
                "iscrowd": 0,
            },
            "category": {
                "id": self.bbox_data["category_id"],
                "category": cfg.dataset.class_names[
                    get_transformed_cat(self.bbox_data["category_id"])
                ],
            },
        }

        return output

    def serialize(self):
        serializer = TypeSerializer()
        output = {
            "category": serializer.serialize(
                cfg.dataset.class_names[
                    get_transformed_cat(self.bbox_data["category_id"])
                ]
            ),
            "data": serializer.serialize(self.mask_data["segmentation"]),
            "score": serializer.serialize(Decimal(str(self.mask_data["score"]))),
        }

        return output
