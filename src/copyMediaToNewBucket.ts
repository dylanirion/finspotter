import { URL } from "url"
import { parseArgs } from "util"
import {
  CopyObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"
import { Resource } from "sst"

import { db } from "../packages/core/src/database/_drizzle"
import { mediaTable } from "../packages/core/src/database/_drizzle/schema"

//TODO: force all canvas media through _next/image
//TODO: move "yolact" outside of _assets? to prevent access through cloudfront

const options = {
  source: {
    type: "string",
    short: "s",
  },
  prefix: {
    type: "string",
  },
  pattern: {
    type: "string",
    short: "p",
  },
  replace: {
    type: "string",
    short: "r",
  },
} as const
const { values: args } = parseArgs({
  args: process.argv,
  options,
  allowPositionals: true,
})
const sourceBucket = args.source
const destinationBucket = Resource.UploadAssets.name

const s3 = new S3Client()

function getKeyFromSrc(src: string) {
  try {
    // if absolute URL, extract path
    const { pathname: sourceKey } = new URL(src)
    return decodeURI(sourceKey)
  } catch (error) {
    if (error instanceof TypeError) {
      // else return src (it's a relative URL)
      return src
    } else {
      throw error
    }
  }
}

async function checkKeyExists(bucket: string, key: string) {
  return s3
    .send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )
    .then(() => true)
    .catch((error) => {
      if (error instanceof NotFound) {
        return false
      }
      throw error
    })
}

async function copyObject(
  source: { bucket: string; key: string },
  destination: { bucket: string; key: string }
) {
  return s3
    .send(
      new CopyObjectCommand({
        Bucket: destination.bucket,
        Key: destination.key,
        CopySource: `${source.bucket}/${source.key}`,
      })
    )
    .catch((error) => {
      throw error
    })
}

function printStatus(status: string) {
  process.stdout.clearLine(0)
  process.stdout.cursorTo(0)
  process.stdout.write(status)
}

async function main() {
  try {
    if (!sourceBucket)
      throw new Error("Provide a source bucket with `-s <bucket name>`")
    const media = await db.query.mediaTable.findMany({
      columns: { id: true, src: true },
    })
    for (const { id, src } of media) {
      const sourceKey = getKeyFromSrc(src).replace(/^\/?/, "")
      const destinationKey =
        args.pattern && args.replace
          ? sourceKey.replace(new RegExp(args.pattern), args.replace)
          : sourceKey
      printStatus(`${sourceKey}`)
      const keyExists = await checkKeyExists(
        destinationBucket,
        `${args.prefix}/${destinationKey}`
      )
      const isSrcRelative = sourceKey == src.replace(/^\/?/, "")
      // if key already exists in destination bucket, and sourceKey != src (it's not a relative path) just update src in db
      if (keyExists && !isSrcRelative) {
        printStatus(`${sourceKey} exists, updating..`)
        await db
          .update(mediaTable)
          //TODO: take this from prefix?
          .set({ src: `/${destinationKey.replace(/^_assets\//, "")}` })
          .where(eq(mediaTable.id, id))
        // if key does not exist, but it's a relative path, copy it
      } else if (!keyExists) {
        printStatus(`${sourceKey} copying...`)
        await copyObject(
          { bucket: sourceBucket, key: sourceKey },
          { bucket: destinationBucket, key: `${args.prefix}/${destinationKey}` }
        )
        // if sourceKey is not the same, update db
        if (!isSrcRelative) {
          printStatus(`${sourceKey} updating...`)
          await db
            .update(mediaTable)
            //TODO: take this from prefix?
            .set({ src: `/${destinationKey.replace(/^_assets\//, "")}` })
            .where(eq(mediaTable.id, id))
        }
        // otherwise db is already up to date
        printStatus(`${sourceKey} exists, up to date...`)
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    printStatus("Complete!\n")
    process.exit(0)
  }
}

main()
