import { type PgVectorConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface SearchRegistry {
    "pgvector:indexed": { config: PgVectorConfig }
  }
}
