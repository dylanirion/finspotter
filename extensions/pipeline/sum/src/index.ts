/** @module @finspotter/sum */
import { PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

import { refine } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/sum",
  name: "sum",
  refine,
})
