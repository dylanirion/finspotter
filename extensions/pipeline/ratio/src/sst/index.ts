import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { type MatchRefinementFunction } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

export const refine: MatchRefinementFunction = ({ bucket, table }) =>
  createPipelineFunction(
    "Ratio",
    {
      runtime: "python3.13",
      handler: "app.lambda_handler",
      code: new $util.asset.AssetArchive({
        ".": new $util.asset.FileArchive(
          "../../extensions/pipeline/ratio/refine"
        ),
      }),
      memorySize: 256,
      architectures: ["x86_64"],
      timeout: 90,
    },
    bucket,
    table
  )
