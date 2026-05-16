/** @module @finspotter/ratio */
import { PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

import { ratioConfigSchema } from "./schema"
import { refine } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/ratio",
  name: "ratio",
  refine,
  config: ratioConfigSchema,
})
