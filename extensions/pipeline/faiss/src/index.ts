/** @module @finspotter/faiss */
import { PipelinePackage } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

import { pairwise } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/faiss",
  name: "faiss",
  search: { pairwise },
  configType: {
    pairwise: `{
    index_string?: string
  }`,
  },
})
