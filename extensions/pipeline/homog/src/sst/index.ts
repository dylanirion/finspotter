import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type MatchRefinementFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const refine: MatchRefinementFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Homog",
    {
      context: {
        location: "../../extensions/pipeline/homog/refine",
      },
      memorySize: 256,
      architectures: ["x86_64"],
      timeout: 90,
    },
    bucket,
    table
  )
