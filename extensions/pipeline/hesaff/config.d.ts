import { type HesaffConfig } from "./src/schema"

declare module "@finspotter/pipeline" {
  interface ExtractionRegistry {
    hesaff: { config: HesaffConfig }
  }
}
