import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type SearchFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const pairwise: SearchFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "FaissPairwise",
    {
      runtime: "python3.13",
      handler: "extensions/pipeline/faiss/pairwise/app.lambda_handler",
      python: {
        container: true,
      },
      memory: "512 MB",
      architecture: "x86_64",
      timeout: "180 seconds",
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
