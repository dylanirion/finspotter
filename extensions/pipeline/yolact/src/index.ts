/** @module @finspotter/yolact */
import { PipelinePackageWithAnnotation } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

import { detect } from "./sst"

export default new PipelinePackageWithAnnotation({
  pkg: "@finspotter/yolact",
  name: "yolact",
  detect,
  configType: `{
    model: {
      bucket: string
      key: string
    }
    dataset: {
      class_names: string[]
      label_map: Record<number, number>
    }
    num_classes: number
    score_threshold: number
  }`,
})
