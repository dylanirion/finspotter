This is an SST Python function that runs instance segmentation with [yolact](https://github.com/dbolya/yolact).

Dependencies are managed by `uv`. SST runs the function locally during `sst dev` and builds a container image for deployment because the PyTorch dependency exceeds Lambda's zip size limit.

The function expects an event with the type `EventData`
```python
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


class EventData(TypedDict):
    id: str
    expiry: str
    payload: S3Object
    config: EventConfig


class Response(S3Object, DynamoItem):
    pass
```

where payload identifies the location of an image on S3, and model, the location of model weights on S3

## Test locally

Install the Python dependencies from the repository root:

```bash
uv sync --all-packages
```

Then start SST Live development:

```bash
pnpm dev
```
