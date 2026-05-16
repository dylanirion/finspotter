import {
  ContainerFunction,
  type ContainerFunctionArgs,
} from "../ContainerFunction"

type PipelineFunctionFactoryArgs =
  | ContainerFunctionArgs
  | Omit<aws.lambda.FunctionArgs, "role">
  | sst.aws.FunctionArgs

export function createPipelineFunction(
  name: string,
  args: PipelineFunctionFactoryArgs,
  bucket: aws.s3.Bucket,
  table: sst.aws.Dynamo
): $util.Output<aws.lambda.Function> {
  const role = new aws.iam.Role(`${name}Role`, {
    name: `${$app.name}-${$app.stage}-${name}Role`,
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "lambda.amazonaws.com",
    }),
    inlinePolicies: [
      {
        name: "bucketPolicy",
        policy: bucket.arn.apply((arn) =>
          aws.iam
            .getPolicyDocument({
              version: "2012-10-17",
              statements: [
                {
                  effect: "Allow",
                  actions: [
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:PutObjectTagging",
                    "s3:ListBucket",
                  ],
                  resources: [`${arn}/*`],
                },
              ],
            })
            .then((doc) => doc.json)
        ),
      },
      {
        name: "tablePolicy",
        policy: table.arn.apply((arn) =>
          aws.iam
            .getPolicyDocument({
              version: "2012-10-17",
              statements: [
                {
                  effect: "Allow",
                  actions: [
                    "dynamodb:BatchGetItem",
                    "dynamodb:BatchWriteItem",
                    "dynamodb:ConditionCheckItem",
                    "dynamodb:PutItem",
                    "dynamodb:DescribeTable",
                    "dynamodb:DeleteItem",
                    "dynamodb:GetItem",
                    "dynamodb:Scan",
                    "dynamodb:Query",
                    "dynamodb:UpdateItem",
                  ],
                  resources: [arn],
                },
              ],
            })
            .then((doc) => doc.json)
        ),
      },
    ],
    managedPolicyArns: [
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    ],
  })

  const fn = isContainerFunctionArgs(args)
    ? new ContainerFunction(name, {
        ...args,
        environment: {
          variables: {
            ...(args?.environment &&
              "variables" in args.environment &&
              args.environment?.variables),
            BUCKET: bucket.id,
            TABLE: table.name,
          },
        },
        role: role,
      })
    : isLambdaFunctionArgs(args)
      ? new aws.lambda.Function(name, {
          ...args,
          name: `${$app.name}-${$app.stage}-${name}Function`,
          environment: {
            variables: {
              ...(args.environment &&
                "variables" in args.environment &&
                args.environment?.variables),
              BUCKET: bucket.id,
              TABLE: table.name,
            },
          },
          role: role.arn,
        })
      : new sst.aws.Function(name, {
          ...(args as sst.aws.FunctionArgs),
          environment: {
            BUCKET: bucket.id,
            TABLE: table.name,
          },
          role: role.arn,
        })

  return "nodes" in fn ? fn.nodes.function : $util.output(fn)
}

export type Transform<T> =
  | Partial<T>
  | ((args: T, name: string, opts?: $util.CustomResourceOptions) => undefined)

export function transform<T extends object>(
  transform: Transform<T> | undefined,
  name: string,
  args: T,
  opts?: $util.CustomResourceOptions
) {
  // Case: transform is a function
  if (typeof transform === "function") {
    transform(args, name, opts)
    return [name, args, opts] as const
  }

  // Case: no transform
  // Case: transform is an argument
  return [name, { ...args, ...transform }, opts] as const
}

function isContainerFunctionArgs(
  args: PipelineFunctionFactoryArgs
): args is ContainerFunctionArgs {
  return (args as any)?.context !== undefined
}

function isLambdaFunctionArgs(
  args: PipelineFunctionFactoryArgs
): args is Omit<aws.lambda.FunctionArgs, "role"> {
  return (args as any)?.code !== undefined
}
