import { type HomogConfig } from "./src/schema"

declare module "@finspotter/pipeline" {
  interface RefinementRegistry {
    homog: { config: HomogConfig }
  }
}
