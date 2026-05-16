/** @module @finspotter/homog */
import { PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

import { homogConfigSchema } from "./schema"
import { refine } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/homog",
  name: "homog",
  refine,
  config: homogConfigSchema,
})
