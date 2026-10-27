import { z } from "zod"

export const lnbnnConfigSchema = z.object({
  ratioThreshold: z.number().positive().max(1).optional(),
  minMatches: z.number().int().min(1).default(1),
  minScore: z.number().finite().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(50),
})

export type LnbnnConfig = z.input<typeof lnbnnConfigSchema>
