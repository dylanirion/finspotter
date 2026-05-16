/** @module @finspotter/hesaff */
import { PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

import { hesaffConfigSchema } from "./schema"
import { extract } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/hesaff",
  name: "hesaff",
  extract,
  config: hesaffConfigSchema,
})
