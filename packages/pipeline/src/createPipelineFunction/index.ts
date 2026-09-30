import { type PipelineBucket } from "../MediaProcessingPipeline/PipelinePackage"

export function createPipelineFunction(
  name: string,
  args: sst.aws.FunctionArgs,
  bucket: PipelineBucket,
  table: sst.aws.Dynamo
): $util.Output<aws.lambda.Function> {
  const fn = new sst.aws.Function(name, {
    ...args,
    environment: {
      ...args.environment,
      BUCKET: bucket.name,
      TABLE: table.name,
    },
    link: $util
      .output(args.link ?? [])
      .apply((links) => [...links, bucket, table]),
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
