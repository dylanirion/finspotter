import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type MatchRefinementFunction } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

export const refine: MatchRefinementFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Sum",
    {
      runtime: "nodejs22.x",
      handler: "extensions/pipeline/sum/src/refine/index.handler",
      memorySize: "256 MB",
      architectures: "x86_64",
      timeout: "90 seconds",
      dev: false,
    },
    bucket,
    table
  )
