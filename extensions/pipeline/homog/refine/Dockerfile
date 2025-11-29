FROM public.ecr.aws/lambda/python:3.12

COPY app.py requirements.txt ${LAMBDA_TASK_ROOT}

RUN python3.12 -m pip install --upgrade pip --root-user-action=ignore
RUN python3.12 -m pip install -r requirements.txt --root-user-action=ignore --no-cache-dir

CMD ["app.lambda_handler"]
