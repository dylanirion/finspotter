import {
  ContainerFunction,
  type ContainerFunctionArgs,
} from "../ContainerFunction"
import { type PipelineBucket } from "../MediaProcessingPipeline/PipelinePackage"

type PipelineFunctionFactoryArgs =
  | ContainerFunctionArgs
  | Omit<aws.lambda.FunctionArgs, "role">
  | sst.aws.FunctionArgs

// TODO: Remove or simplify this helper if it continues to only wrap sst.aws.Function.
export function createPipelineFunction(
  name: string,
  args: PipelineFunctionFactoryArgs,
  bucket: PipelineBucket,
  table: sst.aws.Dynamo
): $util.Output<aws.lambda.Function> {
  const functionArgs = args as sst.aws.FunctionArgs

  const fn = new sst.aws.Function(name, {
    ...functionArgs,
    environment: {
      ...functionArgs.environment,
      BUCKET: bucket.name,
      TABLE: table.name,
    },
    link: $util
      .output(functionArgs.link ?? [])
      .apply((links) => [...links, bucket, table]),
  })

  /*
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
      */

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
