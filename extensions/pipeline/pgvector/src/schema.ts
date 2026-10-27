import { z } from "zod"

export const pgVectorConfigSchema = z.object({
  k: z.number().int().min(1).max(100).default(5),
  knorm: z.number().int().min(1).max(100).default(1),
})

export type PgVectorConfig = z.input<typeof pgVectorConfigSchema>
