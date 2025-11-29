"use server"

import { randomBytes } from "crypto"
import { headers } from "next/headers"
import { createMediaRepository, Media } from "@finspotter/core/media"
import { validateReCaptcha } from "@finspotter/core/recaptcha"
import { createStorageRepository } from "@finspotter/core/storage"
import { getAnnotationTypes } from "@finspotter/pipeline/"
import {
  invoke,
  type DetectionItem,
  type ExtractionItem,
  type MediaItem,
  type StatusItem,
} from "@finspotter/pipeline/invoke"
import { dataTagErrorSymbol } from "@tanstack/react-query"
import { getSession } from "lib/auth"
import { customAlphabet } from "nanoid/non-secure"
import { Resource } from "sst"

export type Event = {
  event:
    | StatusEvent
    | {
        invalidate: string
      }
  id: string
  type: "data"
}

type StatusEvent = {
  pk: string
  status:
    | "submitted"
    | "initialised"
    | "detecting"
    | "extracting"
    | "searching (pairwise)"
    | "searching (indexed)"
    | "succeeded"
    | "failed"
  created_at: string
}

const { getItem, putItems, queryItems } = createStorageRepository()
const { findMany } = createMediaRepository()

const makeSubmissionId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21
)

//TODO: model & cfg should come from database, and condition on detect method
export async function createDemoJob({
  submissionId,
  mediaId,
  type,
  bucket,
  key,
  token,
}: {
  submissionId: string
  mediaId: string
  type: string
  bucket: string
  key: string
  token?: string
}) {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) {
    if (!token) {
      throw new Error(
        "Unauthenticated request: user or reCAPTCHA token required."
      )
    }

    await validateReCaptcha(token)
  }

  const now = new Date()
  const createdAt = now.toISOString()
  const expires = Math.floor((now.getTime() + 1 * 24 * 60 * 60 * 1000) / 1000)

  await putItems(Resource.ImageProcessingPipeline.table, [
    {
      pk: submissionId,
      sk: `media#${mediaId}`,
      media_id: mediaId,
      type,
      uri: { bucket, key },
      gsi1pk: "result",
      created_at: createdAt,
      expires,
    },
    {
      pk: submissionId,
      sk: "status",
      status: "submitted",
      created_at: new Date().toISOString(),
      expires,
    },
  ])

  return invoke<"yolact", "hesaff", "pgvector:indexed">({
    submissionId,
    payload: [
      {
        pk: submissionId,
        sk: `media#${mediaId}`,
        media_id: mediaId,
        bucket,
        key,
      },
    ],
    detect: {
      //TODO: get default detection function from database
      functionName:
        Resource.ImageProcessingPipeline.detectionFunctions["yolact"],
      //TODO: get config from database
      config: {
        model: {
          bucket: Resource.UploadAssets.name,
          key: "_assets/yolact/weights/yolact_base_255_11000.pth",
        },
        dataset: {
          class_names: [
            "haploblepharus_pictus",
            "haploblepharus_edwardsii",
            "poroderma_africanum",
            "poroderma_pantherinum",
          ],
          label_map: { 0: 1, 1: 2, 2: 3, 3: 4 },
        },
        num_classes: 4 + 1,
        score_threshold: 0.5,
      },
    },
    extract: {
      functionName:
        Resource.ImageProcessingPipeline.extractionFunctions["hesaff"],
      config: null,
    },
    search: {
      type: "indexed",
      functionName:
        Resource.ImageProcessingPipeline.searchFunctions["pgvector:indexed"],
      config: null,
    },
    expires,
  })
}

export async function createDetectionJob(mediaId: string[]) {
  const session = await getSession({ headers: await headers() })
  //TODO check permissions?

  const submissionId = makeSubmissionId()
  const now = new Date()
  const createdAt = now.toISOString()

  const media = await findMany({ id: { operator: "in", value: mediaId } })
  if (!media) throw new Error("No media found")

  //TODO: this is probably very similar to what happens in submission?
  await putItems(Resource.ImageProcessingPipeline.table, [
    ...media.map((item) => ({
      pk: submissionId,
      sk: `media#${item.id}`,
      media_id: item.id,
      type: item.exif.content_type,
      uri: {
        bucket: Resource.UploadAssets.name,
        key: `_assets${item.src}`,
      },
      gsi1pk: "result",
      created_at: createdAt,
    })),
    {
      pk: submissionId,
      sk: "status",
      status: "submitted",
      created_at: new Date().toISOString(),
    },
  ])

  return invoke<"yolact", "hesaff">({
    submissionId,
    payload: media.map((item) => ({
      pk: submissionId,
      sk: `media#${item.id}`,
      media_id: item.id,
      bucket: Resource.UploadAssets.name,
      key: `_assets${item.src}`,
    })),
    detect: {
      //TODO: get default detection function from database
      functionName:
        Resource.ImageProcessingPipeline.detectionFunctions["yolact"],
      //TODO: get config from database
      config: {
        model: {
          bucket: Resource.UploadAssets.name,
          key: "_assets/yolact/weights/yolact_base_255_11000.pth",
        },
        dataset: {
          class_names: [
            "haploblepharus_pictus",
            "haploblepharus_edwardsii",
            "poroderma_africanum",
            "poroderma_pantherinum",
          ],
          label_map: { 0: 1, 1: 2, 2: 3, 3: 4 },
        },
        num_classes: 4 + 1,
        score_threshold: 0.5,
      },
    },
    extract: {
      functionName:
        Resource.ImageProcessingPipeline.extractionFunctions["hesaff"],
      config: null,
    },
    expires: null,
  })
}

export async function getItemsForReview(
  limit = 12,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursor?: Record<string, any>
) {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized access.")

  //TODO check permissions? will need to filter only items that user has permission to see/review
  //TODO: filter locked_at if not admin (can display locked icon for admins)? filter items already reviewed by user
  return queryItems<{
    pk: string
    sk: string
    gsi1pk: string
    created_at: string
    final: boolean
    locked_at: string
  }>(
    Resource.ImageProcessingPipeline.table,
    {
      gsi1pk: "result",
      final: true,
      expires: { operator: "not_exists" },
      locked_at: { operator: "not_exists" }, //TODO: this should actually be greater than
    },
    limit,
    "gsi1",
    cursor,
    ["gsi1pk", "sk"]
  )
}

export async function getPipelineActivity(
  limit = 12,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursor?: Record<string, any>
) {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized access.")

  //TODO check permissions? will need to filter only items that user has permission to see

  return queryItems<StatusItem>(
    Resource.ImageProcessingPipeline.table,
    {
      gsi1pk: "status",
      status: { operator: "not_in", value: ["succeeded", "failed"] },
    },
    limit,
    "gsi1",
    cursor,
    ["gsi1pk", "sk"],
    false
  )
}

//TODO: get exif data?
//TODO: does this need to check permissions?
//TODO: what happens when the same image is in the pipeline multiple times?
export async function getSingleMedia(id: string) {
  const { items } = await queryItems<MediaItem | DetectionItem>(
    Resource.ImageProcessingPipeline.table,
    { media_id: id },
    undefined,
    "gsi2",
    undefined,
    ["media_id"]
  )
  return items.reduce((acc, cur) => {
    if (cur.sk.startsWith("media")) {
      const media = cur as MediaItem
      acc.id = id
      acc.src = media.uri.key.replace(/^_assets\//, "")
    }
    if (cur.sk.startsWith("detection")) {
      const detection = cur as DetectionItem

      const newAnnotation = {
        id: `$${randomBytes(10).toString("hex")}`,
        mediaId: detection.media_id,
        category: detection.category,
        type: getAnnotationTypes[detection.type],
        data: detection.data,
        source: detection.type,
        score: detection.score,
      }
      acc.annotations = acc.annotations
        ? [...acc.annotations, newAnnotation]
        : [newAnnotation]
    }
    return acc
  }, {} as Media)
}

/*
export async function getDetection(key: string): Promise<DetectionResponse> {
  const { body, metadata } = await getObject(Resource.UploadAssets.name, key)
  const json = JSON.parse(await streamToString(body as Readable))
  return { type: metadata.type, ...json }
}
*/

//TODO: obscure key format (accept media_id, detection_id, type?)
export async function getDetection(key: {
  pk: string
  sk: string
}): Promise<Partial<DetectionItem>> {
  const { type, category, data, score } = await getItem<DetectionItem>(
    Resource.ImageProcessingPipeline.table,
    key
  )
  return { type, category, data, score }
}

export async function getDetections(key: {
  pk: string
}): Promise<Partial<DetectionItem>[]> {
  const { items } = await queryItems<DetectionItem>(
    Resource.ImageProcessingPipeline.table,
    {
      pk: key.pk,
      sk: { operator: "starts_with", value: "detection" },
    }
  )
  return items.map((item) => {
    const { type, category, data, score } = item
    return { type, category, data, score }
  })
}
