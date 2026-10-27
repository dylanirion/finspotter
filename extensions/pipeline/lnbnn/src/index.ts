/** @module @finspotter/lnbnn */
import { PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

import { lnbnnConfigSchema } from "./schema"
import { score } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/lnbnn",
  name: "lnbnn",
  score,
  config: lnbnnConfigSchema,
})
