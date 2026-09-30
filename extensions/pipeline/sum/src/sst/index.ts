import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type MatchRefinementFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const refine: MatchRefinementFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Sum",
    {
      runtime: "nodejs22.x",
      handler: "extensions/pipeline/sum/src/refine/index.handler",
      memory: "256 MB",
      architecture: "x86_64",
      timeout: "90 seconds",
      ...($dev && {
        environment: {
          RUSTFS_ACCESS_KEY: process.env.RUSTFS_ACCESS_KEY!,
          RUSTFS_SECRET_KEY: process.env.RUSTFS_SECRET_KEY!,
        },
      }),
    },
    bucket,
    table
  )
