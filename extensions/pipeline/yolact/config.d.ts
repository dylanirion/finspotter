import { type YolactConfig } from "./src/schema"

declare module "@finspotter/pipeline" {
  interface DetectionRegistry {
    yolact: { config: YolactConfig }
  }
}
