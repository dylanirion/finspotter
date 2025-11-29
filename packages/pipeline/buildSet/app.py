from typing import TypedDict
from itertools import combinations


class S3Object(TypedDict):
    bucket: str
    key: str


class DynamoItem(TypedDict):
    pk: str
    sk: str


class Payload(S3Object, DynamoItem):
    media_id: str
    detection_id: str


class EventData(TypedDict):
    payload: list[Payload]


def lambda_handler(event: EventData, context) -> list[tuple[Payload, Payload]]:
    return [
        sort_pair(a, b)
        for a, b in combinations(event["payload"], 2)
        if a["media_id"] != b["media_id"]
    ]


def sort_pair(a: Payload, b: Payload) -> tuple[Payload, Payload]:
    return (a, b) if a["key"] <= b["key"] else (b, a)
