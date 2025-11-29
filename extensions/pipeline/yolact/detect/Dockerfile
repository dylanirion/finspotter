FROM public.ecr.aws/lambda/python:3.13

COPY app.py requirements.txt ${LAMBDA_TASK_ROOT}
ADD yolact_cpu ${LAMBDA_TASK_ROOT}/yolact_cpu

RUN dnf update -y
RUN dnf install gcc -y

RUN python3.13 -m pip install --upgrade pip --root-user-action=ignore
RUN python3.13 -m pip install -r requirements.txt --root-user-action=ignore --no-cache-dir

CMD ["app.lambda_handler"]
