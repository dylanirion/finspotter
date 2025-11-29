import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type SearchFunction } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

export const pairwise: SearchFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "FaissPairwise",
    {
      context: {
        location: "../../extensions/pipeline/faiss/pairwise",
      },
      memorySize: 512,
      architectures: ["x86_64"],
      timeout: 180,
    },
    bucket,
    table
  )
