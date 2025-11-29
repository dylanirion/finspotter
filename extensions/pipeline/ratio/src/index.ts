/** @module @finspotter/ratio */
import { PipelinePackage } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

import { refine } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/ratio",
  name: "ratio",
  refine,
  configType: `{
    threshold?: number
  }`,
})
