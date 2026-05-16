import { type FaissConfig } from "./src/schema"

declare module "@finspotter/pipeline" {
  interface SearchRegistry {
    "faiss:pairwise": { config: FaissConfig }
  }
}
