import os

import boto3
from botocore.config import Config


def get_client(service_name, **options):
    if os.getenv("SST_DEV") != "true" or service_name != "s3":
        return boto3.client(service_name, **options)

    options.update(
        endpoint_url=os.getenv("AWS_ENDPOINT_URL_S3", "http://localhost:9000"),
        aws_access_key_id=os.getenv("RUSTFS_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("RUSTFS_SECRET_KEY"),
        config=Config(s3={"addressing_style": "path"}),
    )
    return boto3.client(service_name, **options)