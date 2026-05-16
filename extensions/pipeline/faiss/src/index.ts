/** @module @finspotter/faiss */
import { PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

import { faissConfigSchema } from "./schema"
import { pairwise } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/faiss",
  name: "faiss",
  search: { pairwise },
  config: faissConfigSchema,
})
