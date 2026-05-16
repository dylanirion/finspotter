import { z } from "zod"

export const hesaffConfigSchema = z.object({
  numberOfScales: z.number().optional(),
  threshold: z.number().optional(),
  edgeEigenValueRatio: z.number().optional(),
  border: z.number().optional(),
  maxPyramidLevels: z.number().optional(),
  maxIterations: z.number().optional(),
  convergenceThreshold: z.number().optional(),
  smmWindowSize: z.number().optional(),
  mrSize: z.number().optional(),
  spatialBins: z.number().optional(),
  orientationBins: z.number().optional(),
  maxBinValue: z.number().optional(),
  initialSigma: z.number().optional(),
  patchSize: z.number().optional(),
  scale_min: z.number().optional(),
  scale_max: z.number().optional(),
  rotation_invariance: z.boolean().optional(),
  augment_orientation: z.boolean().optional(),
  ori_maxima_thresh: z.number().optional(),
  affine_invariance: z.boolean().optional(),
  only_count: z.boolean().optional(),
  use_dense: z.boolean().optional(),
  dense_stride: z.number().optional(),
  siftPower: z.number().optional(),
})

export type HesaffConfig = z.infer<typeof hesaffConfigSchema>
