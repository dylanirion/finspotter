import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type ScoringFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const score: ScoringFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Lnbnn",
    {
      runtime: "nodejs22.x",
      handler: "extensions/pipeline/lnbnn/src/score/index.handler",
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
