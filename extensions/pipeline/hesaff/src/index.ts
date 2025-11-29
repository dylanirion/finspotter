/** @module @finspotter/hesaff */
import { PipelinePackage } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

import { extract } from "./sst"

export default new PipelinePackage({
  pkg: "@finspotter/hesaff",
  name: "hesaff",
  extract,
  configType: `{
    numberOfScales?: number
    threshold?: number
    edgeEigenValueRatio?: number
    border?: number
    maxPyramidLevels?: number
    maxIterations?: number
    convergenceThreshold?: number
    smmWindowSize?: number
    mrSize?: number
    spatialBins?: number
    orientationBins?: number
    maxBinValue?: number
    initialSigma?: number
    patchSize?: number
    scale_min?: number
    scale_max?: number
    rotation_invariance?: boolean
    augment_orientation?: boolean
    ori_maxima_thresh?: number
    affine_invariance?: boolean
    only_count?: boolean
    use_dense?: boolean
    dense_stride?: number
    siftPower?: number
  }`,
})
