import { type HomogConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface RefinementRegistry {
    homog: { config: HomogConfig }
  }
}
