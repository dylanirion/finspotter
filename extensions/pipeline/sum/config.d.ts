// below is just "null", but ensures augmentation instead of declaration
import { SumConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface RefinementRegistry {
    sum: { config: SumConfig }
  }
}
