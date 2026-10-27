import { type LnbnnConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface RefinementRegistry {
    lnbnn: { config: LnbnnConfig }
  }
}
