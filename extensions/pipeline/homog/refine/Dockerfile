FROM public.ecr.aws/lambda/python:3.13

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

RUN dnf install -y git gcc python3-devel && dnf clean all

COPY . ${LAMBDA_TASK_ROOT}
RUN uv pip install -r requirements.txt --target ${LAMBDA_TASK_ROOT} --system
