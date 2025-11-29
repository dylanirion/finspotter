This is a [Docker](https://www.docker.com/) container that runs instance segmentation with [yolact](https://github.com/dbolya/yolact).

See [here](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html) for more information on deploying Docker containers as AWS Lambda functions

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

First, build the container.

```bash
docker build image/ -t yolact:detect
```

Then run the container with:

```bash
docker run -p 9000:8080 yolact:detect
```

From another terminal, invoke the function by posting an event to the endpoint:

```bash
curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'
```

To stop the container, find the ID:

```bash
docker ps
```

Then, replacing `<3766c4ab331c>` with the contiainer ID

```bash
docker kill <3766c4ab331c>
```
