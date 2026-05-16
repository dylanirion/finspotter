import { type RatioConfig } from "./src/schema"

declare module "@finspotter/pipeline" {
  interface RefinementRegistry {
    ratio: { config: RatioConfig }
  }
}
