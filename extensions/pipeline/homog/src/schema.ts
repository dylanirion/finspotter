import { z } from "zod"

export const homogConfigSchema = z.object({
  ransacReprojThreshold: z.number().optional(),
})

export type HomogConfig = z.infer<typeof homogConfigSchema>
