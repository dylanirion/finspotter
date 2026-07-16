import { type FaissConfig } from "./src/schema"

declare module "@finspotter/config/pipeline" {
  interface SearchRegistry {
    "faiss:pairwise": { config: FaissConfig }
  }
}
