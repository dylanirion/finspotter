import { type HesaffConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface ExtractionRegistry {
    hesaff: { config: HesaffConfig }
  }
}
