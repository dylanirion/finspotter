from typing import Any, Mapping, cast


def require_object(
    value: object,
    required_keys: tuple[str, ...],
    name: str,
) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TypeError(
            f"Expected {name} to be an object, got {type(value).__name__}: {value!r}. "
            "An upstream Lambda may have returned an error response as data."
        )

    missing_keys = [key for key in required_keys if key not in value]
    if missing_keys:
        raise ValueError(f"{name} is missing required fields: {', '.join(missing_keys)}")

    return value


def require_object_payload(
    event: Mapping[str, object], required_keys: tuple[str, ...]
) -> dict[str, Any]:
    return require_object(event.get("payload"), required_keys, "event.payload")


def require_object_list_payload(
    event: Mapping[str, object],
    required_keys: tuple[str, ...],
    expected_length: int,
) -> list[dict[str, Any]]:
    payload = event.get("payload")
    if not isinstance(payload, list):
        raise TypeError(
            "Expected event.payload to be a list, "
            f"got {type(payload).__name__}: {payload!r}. "
            "An upstream Lambda may have returned an error response as data."
        )
    if len(payload) != expected_length:
        raise ValueError(
            f"Expected event.payload to contain {expected_length} items, "
            f"got {len(payload)}"
        )

    return [
        require_object(value, required_keys, f"event.payload[{index}]")
        for index, value in enumerate(cast(list[object], payload))
    ]