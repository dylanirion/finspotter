import { z } from "zod"

export const sumConfigSchema = z.null()

export type SumConfig = z.infer<typeof sumConfigSchema>
