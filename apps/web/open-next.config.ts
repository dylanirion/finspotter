import { type OpenNextConfig } from "@opennextjs/aws/types/open-next.js"

export default {
  default: {
    override: {
      tagCache: "dynamodb-lite",
      incrementalCache: "s3-lite",
      queue: "sqs-lite",
    },
    //minify: true, // errors on sharp
  },
  /*
  //TODO: custom imageLoader to load from mutiple s3 buckets
  //TODO: minimumCacheTTL for images, should be long
  // https://discord.com/channels/983865673656705025/1287024279707320382
  imageOptimization: {
    //loader: () => import("./overrides/customImageLoader").then((module) => module.default)
    install : {
      packages: ["sharp@0.33"],
      arch: "arm64",
      nodeVersion: "22",
      libc: "glibc"
    }
  }
  */
} satisfies OpenNextConfig
