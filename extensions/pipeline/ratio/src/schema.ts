import { z } from "zod"

export const ratioConfigSchema = z.object({
  threshold: z.number().optional(),
})

export type RatioConfig = z.infer<typeof ratioConfigSchema>
