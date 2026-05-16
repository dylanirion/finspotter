import { z } from "zod"

export const yolactConfigSchema = z.object({
  model: z.object({
    bucket: z.string(),
    key: z.string(),
  }),
  dataset: z.object({
    class_names: z.array(z.string()),
    label_map: z.record(z.number(), z.number()),
  }),
  num_classes: z.number(),
  score_threshold: z.number(),
})

export type YolactConfig = z.infer<typeof yolactConfigSchema>
