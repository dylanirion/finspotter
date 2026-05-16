import { type PgVectorConfig } from "./src/schema"

declare module "@finspotter/pipeline" {
  interface SearchRegistry {
    "pgvector:indexed": { config: PgVectorConfig }
  }
}
