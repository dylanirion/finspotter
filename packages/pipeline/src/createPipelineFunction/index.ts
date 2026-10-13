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

  return fn.nodes.function
}
