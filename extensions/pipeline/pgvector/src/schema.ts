import { z } from "zod"

export const pgVectorConfigSchema = z.object({})

export type PgVectorConfig = z.infer<typeof pgVectorConfigSchema>
