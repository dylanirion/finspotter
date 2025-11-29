import https from "node:https"
import { pipeline } from "node:stream"
import { promisify } from "node:util"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import express from "express"
import { Resource } from "sst"

const KEYPREFIX = "_assets"
const BUCKET_NAME = Resource.UploadAssets.name

const app = express()
const s3 = new S3Client({ region: process.env.AWS_REGION })
const streamPipeline = promisify(pipeline)

app.get("/_next/image", async (req, res) => {
  const src = req.query.src as string | undefined
  if (!src) return res.status(400).send("Missing src")

  console.log(`requesting ${src}`)

  try {
    if (/^https?:\/\//i.test(src)) {
      // Remote image
      https
        .get(src, (remoteRes) => {
          // Propagate headers
          if (remoteRes.headers["content-type"]) {
            res.setHeader("Content-Type", remoteRes.headers["content-type"])
          }
          if (remoteRes.headers["cache-control"]) {
            res.setHeader("Cache-Control", remoteRes.headers["cache-control"])
          }
          res.setHeader("Access-Control-Allow-Origin", "*")

          // Pipe response directly
          remoteRes.pipe(res)
        })
        .on("error", (err) => {
          console.error("Failed to fetch remote image", err)
          res.sendStatus(502)
        })
    } else {
      // Local image from S3
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: KEYPREFIX
            ? `${KEYPREFIX}/${src.replace(/^\//, "")}`
            : src.replace(/^\//, ""),
        })
      )

      if (response.ContentType) {
        res.setHeader("Content-Type", response.ContentType)
      }
      if (response.CacheControl) {
        res.setHeader("Cache-Control", response.CacheControl)
      }
      res.setHeader("Access-Control-Allow-Origin", "*")

      if (!response.Body) {
        return res.sendStatus(404)
      }

      await streamPipeline(response.Body as NodeJS.ReadableStream, res)
    }
  } catch (err) {
    console.error("Image proxy error", err)
    res.sendStatus(500)
  }
})

app.listen(4000, () => {
  console.log("Dev image proxy running on http://localhost:4000")
})
