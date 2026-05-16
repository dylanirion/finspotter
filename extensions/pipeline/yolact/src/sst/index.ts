import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type DetectionFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const detect: DetectionFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Yolact",
    {
      context: {
        location: "../../extensions/pipeline/yolact/detect",
      },
      memorySize: 4096,
      architectures: ["x86_64"],
      timeout: 90,
      environment: {
        variables: {
          HOME: "/tmp", // necessary for cython
        },
      },
    },
    bucket,
    table
  )
