import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type MatchRefinementFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const refine: MatchRefinementFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Homog",
    {
      runtime: "python3.13",
      handler: "extensions/pipeline/homog/refine/app.lambda_handler",
      python: {
        container: true,
      },
      memory: "256 MB",
      architecture: "x86_64",
      timeout: "90 seconds",
      ...($dev && {
        environment: {
          RUSTFS_ACCESS_KEY: process.env.RUSTFS_ACCESS_KEY,
          RUSTFS_SECRET_KEY: process.env.RUSTFS_SECRET_KEY,
        },
      }),
    },
    bucket,
    table
  )
