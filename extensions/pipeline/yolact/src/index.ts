/** @module @finspotter/yolact */
import { PipelinePackageWithAnnotation } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

import { yolactConfigSchema } from "./schema"
import { detect } from "./sst"

export default new PipelinePackageWithAnnotation({
  pkg: "@finspotter/yolact",
  name: "yolact",
  detect,
  config: yolactConfigSchema,
})
