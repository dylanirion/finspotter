/** @module @finspotter/homog */
import { PipelinePackage } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

import { refine } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/homog",
  name: "homog",
  refine,
  configType: `{
    ransacReprojThreshold?: number
  }`,
})
