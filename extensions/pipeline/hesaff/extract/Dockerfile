FROM public.ecr.aws/lambda/python:3.11

COPY app.py requirements.txt ${LAMBDA_TASK_ROOT}

#RUN yum update -y
#RUN yum install gcc gcc-c++ -y
#RUN dnf update -y
#RUN dnf install libopencv-devel cmake gcc g++ -y

RUN python3.11 -m pip install --upgrade pip --root-user-action=ignore
RUN python3.11 -m pip install -r requirements.txt --root-user-action=ignore --no-cache-dir

CMD ["app.lambda_handler"]
