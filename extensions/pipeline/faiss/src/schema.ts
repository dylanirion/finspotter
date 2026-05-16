import { z } from "zod"

export const faissConfigSchema = z.object({
  pairwise: z.object({
    index_string: z.string().optional(),
  }),
})

export type FaissConfig = z.infer<typeof faissConfigSchema>
