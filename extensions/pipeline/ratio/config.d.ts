import { type RatioConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface RefinementRegistry {
    ratio: { config: RatioConfig }
  }
}
