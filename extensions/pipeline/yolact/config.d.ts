import { type YolactConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface DetectionRegistry {
    yolact: { config: YolactConfig }
  }
}
