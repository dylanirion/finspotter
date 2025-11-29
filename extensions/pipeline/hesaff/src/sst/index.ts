import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type ExtractionFunction } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

export const extract: ExtractionFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Hesaff",
    {
      context: {
        location: "../../extensions/pipeline/hesaff/extract",
      },
      memorySize: 4096,
      architectures: ["x86_64"],
      timeout: 90,
    },
    bucket,
    table
  )
