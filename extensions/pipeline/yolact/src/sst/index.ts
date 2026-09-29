import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type DetectionFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const detect: DetectionFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Yolact",
    {
      runtime: "python3.13",
      handler: "extensions/pipeline/yolact/detect/app.lambda_handler",
      python: {
        container: true,
      },
      //memory: "4 GB",
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
