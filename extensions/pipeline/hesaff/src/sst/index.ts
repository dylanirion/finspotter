import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type ExtractionFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const extract: ExtractionFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Hesaff",
    {
      runtime: "python3.13",
      handler: "extensions/pipeline/hesaff/extract/app.lambda_handler",
      python: {
        container: true,
      },
      memory: "3008 MB",
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
