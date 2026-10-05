"use server"

import { randomBytes, randomUUID } from "crypto"
import { headers } from "next/headers"
import { type Annotation } from "@finspotter/core/annotation"
import { can } from "@finspotter/core/auth/permissions"
import { createMediaRepository, Media } from "@finspotter/core/media"
import {
  createPipelineResultRepository,
  type PipelineResult,
  type PipelineResultKind,
} from "@finspotter/core/pipelineResult"
import { validateReCaptcha } from "@finspotter/core/recaptcha"
import { createStorageRepository } from "@finspotter/core/storage"
import {
  invoke,
  type DetectionItem,
  type MediaItem,
  type StatusItem,
} from "@finspotter/pipeline/invoke"
import { getSession } from "lib/auth"
import { createMediaCapability } from "lib/mediaAccess"
import { Resource } from "sst"
import { z } from "zod"

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
    | "materializing"
    | "extracting"
    | "searching (pairwise)"
    | "searching (indexed)"
    | "succeeded"
    | "failed"
  created_at: string
}

const { getItem, getObjectText, putItems, queryItems } = createStorageRepository()
const { findMany } = createMediaRepository()
const pipelineResults = createPipelineResultRepository()

export type ReviewQueueCursor = {
  score: number | null
  readyAt: string
  id: string
}

export type ReviewQueueItem = {
  id: string
  sourcePk: string
  sourceSk: string
  kind: PipelineResultKind
  mediaId: string | null
  payload: Record<string, unknown>
  score: number | null
  readyAt: string
}

export type ReviewClaim = ReviewQueueItem & {
  claimExpiresAt: string
}

export type ReviewComparisonData = {
  query: {
    annotation: Annotation
    media: Pick<Media, "id" | "src" | "exif">
  }
  reference: {
    annotation: Annotation
    media: Pick<Media, "id" | "src" | "exif">
  }
}

export type ReviewComparisonArtifacts = {
  queryFeatures: [number, number][]
  referenceFeatures: [number, number][]
  matches: { from: number; to: number; distance: number }[]
}

const pairReviewPayloadSchema = z.object({
  query: z.object({
    media_id: z.string(),
    detection_id: z.coerce.number().int(),
  }),
  ref: z.object({
    media_id: z.string(),
    detection_id: z.coerce.number().int(),
  }),
  uri: z.object({ bucket: z.string(), key: z.string() }),
  source_query: z.object({ pk: z.string(), sk: z.string() }),
  source_ref: z.object({ pk: z.string(), sk: z.string() }),
})

const keypointsSchema = z.array(z.array(z.number()).min(2))
const matchesSchema = z.array(
  z.object({
    from: z.number().int(),
    to: z.number().int(),
    distance: z.number(),
  })
)

type ReviewExtraction = {
  source_detection: { pk: string; sk: string }
  uri: { keypoints: { bucket: string; key: string } }
}

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

  await putItems(Resource.SubmissionReviewPipeline.table, [
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
        Resource.MediaProcessingPipeline.detectionFunctions["yolact"],
      //TODO: get config from database
      config: {
        model: {
          bucket: Resource.Uploads.name,
          key: "assets/yolact/weights/yolact_base_255_11000.pth",
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
        Resource.MediaProcessingPipeline.extractionFunctions["hesaff"],
      config: null,
    },
    search: {
      type: "indexed",
      functionName:
        Resource.SimilaritySearchPipeline.searchFunctions["pgvector:indexed"],
      config: null,
    },
    expires,
  })
}

export async function createDetectionJob(mediaId: string[]) {
  const session = await getSession({ headers: await headers() })
  //TODO check permissions?

  const submissionId = randomUUID()
  const now = new Date()
  const createdAt = now.toISOString()

  const media = await findMany({ id: { operator: "in", value: mediaId } })
  if (!media) throw new Error("No media found")

  //TODO: this is probably very similar to what happens in submission?
  await putItems(Resource.SubmissionReviewPipeline.table, [
    ...media.map((item) => ({
      pk: submissionId,
      sk: `media#${item.id}`,
      media_id: item.id,
      type: item.exif.content_type,
      uri: {
        bucket: Resource.Uploads.name,
        key: item.src,
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
      bucket: Resource.Uploads.name,
      key: item.src,
    })),
    detect: {
      //TODO: get default detection function from database
      functionName:
        Resource.MediaProcessingPipeline.detectionFunctions["yolact"],
      //TODO: get config from database
      config: {
        model: {
          bucket: Resource.Uploads.name,
          key: "assets/yolact/weights/yolact_base_255_11000.pth",
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
        Resource.MediaProcessingPipeline.extractionFunctions["hesaff"],
      config: null,
    },
    expires: null,
  })
}

export async function getItemsForReview(
  limit = 12,
  cursor?: ReviewQueueCursor
) {
  const session = await getSession({ headers: await headers() })
  if (!session?.user || !can(session.user, "review", "Annotation"))
    throw new Error("Unauthorized access.")

  const page = await pipelineResults.findReviewReady(
    limit,
    cursor
      ? { ...cursor, readyAt: new Date(cursor.readyAt) }
      : undefined
  )

  return {
    items: page.items.map(toReviewQueueItem),
    cursor: page.cursor
      ? {
          ...page.cursor,
          readyAt: page.cursor.readyAt.toISOString(),
        }
      : undefined,
  }
}

export async function claimReviewItem(id: string) {
  const reviewerId = await requireReviewer()

  const claimed = await pipelineResults.claim(id, reviewerId)
  if (!claimed) throw new Error("This item is already being reviewed.")

  return {
    id: claimed.id,
    claimExpiresAt: claimed.claimExpiresAt!.toISOString(),
  }
}

export async function getReviewClaim(id: string): Promise<ReviewClaim | null> {
  const reviewerId = await requireReviewer()
  const claimed = await pipelineResults.findClaimed(id, reviewerId)
  if (!claimed) return null
  return {
    ...toReviewQueueItem(claimed),
    claimExpiresAt: claimed.claimExpiresAt!.toISOString(),
  }
}

export async function getReviewComparison(
  id: string
): Promise<ReviewComparisonData> {
  const { claimed, payload } = await getClaimedPairReview(id)
  const [queryExtraction, referenceExtraction] = await Promise.all([
    getItem<ReviewExtraction>(Resource.SubmissionReviewPipeline.table, {
      pk: payload.source_query.pk,
      sk: payload.source_query.sk,
    }),
    getItem<ReviewExtraction>(Resource.SubmissionReviewPipeline.table, {
      pk: payload.source_ref.pk,
      sk: payload.source_ref.sk,
    }),
  ])
  const [queryMedia, referenceMedia, queryDetection, referenceDetection] =
    await Promise.all([
      getSingleMedia(payload.query.media_id),
      getSingleMedia(payload.ref.media_id),
      getItem<DetectionItem>(Resource.SubmissionReviewPipeline.table, {
        pk: queryExtraction.source_detection.pk,
        sk: queryExtraction.source_detection.sk,
      }),
      getItem<DetectionItem>(Resource.SubmissionReviewPipeline.table, {
        pk: referenceExtraction.source_detection.pk,
        sk: referenceExtraction.source_detection.sk,
      }),
    ])
  if (!queryMedia || !referenceMedia)
    throw new Error("Pair review media not found.")
  if (!claimed.claimExpiresAt) throw new Error("Pair review claim has no expiry.")

  return {
    query: {
      annotation: toReviewAnnotation(queryDetection),
      media: toReviewMedia(queryMedia, claimed.claimExpiresAt),
    },
    reference: {
      annotation: toReviewAnnotation(referenceDetection),
      media: toReviewMedia(referenceMedia, claimed.claimExpiresAt),
    },
  }
}

export async function getReviewComparisonArtifacts(
  id: string
): Promise<ReviewComparisonArtifacts> {
  const { payload } = await getClaimedPairReview(id)
  const [queryExtraction, referenceExtraction] = await Promise.all([
    getItem<ReviewExtraction>(Resource.SubmissionReviewPipeline.table, {
      pk: payload.source_query.pk,
      sk: payload.source_query.sk,
    }),
    getItem<ReviewExtraction>(Resource.SubmissionReviewPipeline.table, {
      pk: payload.source_ref.pk,
      sk: payload.source_ref.sk,
    }),
  ])
  const [queryKeypointsText, referenceKeypointsText, matchesText] =
    await Promise.all([
      getObjectText(
        queryExtraction.uri.keypoints.bucket,
        queryExtraction.uri.keypoints.key
      ),
      getObjectText(
        referenceExtraction.uri.keypoints.bucket,
        referenceExtraction.uri.keypoints.key
      ),
      getObjectText(payload.uri.bucket, payload.uri.key),
    ])
  return {
    queryFeatures: toFeaturePoints(
      keypointsSchema.parse(JSON.parse(queryKeypointsText))
    ),
    referenceFeatures: toFeaturePoints(
      keypointsSchema.parse(JSON.parse(referenceKeypointsText))
    ),
    matches: matchesSchema.parse(JSON.parse(matchesText)),
  }
}

async function getClaimedPairReview(id: string) {
  const reviewerId = await requireReviewer()
  const claimed = await pipelineResults.findClaimed(id, reviewerId)
  if (!claimed || claimed.kind !== "pair")
    throw new Error("Pair review claim not found.")
  return { claimed, payload: pairReviewPayloadSchema.parse(claimed.payload) }
}

export async function renewReviewClaim(id: string) {
  const reviewerId = await requireReviewer()
  const renewed = await pipelineResults.renewClaim(id, reviewerId)
  if (!renewed) throw new Error("Your review claim has expired.")
  return { claimExpiresAt: renewed.claimExpiresAt!.toISOString() }
}

export async function releaseReviewClaim(id: string) {
  const reviewerId = await requireReviewer()
  await pipelineResults.releaseClaim(id, reviewerId)
}

export async function approveDetectionReview(
  reviewId: string,
  annotation: Annotation
) {
  const reviewerId = await requireReviewer()
  const { id: _id, detectionId: _detectionId, updatedAt: _updatedAt, ...input } =
    annotation
  const approved = await pipelineResults.approveDetection(
    reviewId,
    reviewerId,
    input
  )
  if (!approved) throw new Error("Your detection review claim has expired.")
  return [{ id: approved.annotationId! }]
}

async function requireReviewer() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user || !can(session.user, "review", "Annotation"))
    throw new Error("Unauthorized access.")
  return session.user.id
}

function toReviewQueueItem(item: PipelineResult): ReviewQueueItem {
  if (!item.reviewReadyAt) throw new Error("Review item has no readiness time")
  return {
    id: item.id,
    sourcePk: item.sourcePk,
    sourceSk: item.sourceSk,
    kind: item.kind,
    mediaId: item.mediaId,
    payload: item.payload,
    score: item.reviewScore,
    readyAt: item.reviewReadyAt.toISOString(),
  }
}

function toReviewAnnotation(detection: DetectionItem): Annotation {
  return {
    id: `$${randomBytes(10).toString("hex")}`,
    mediaId: detection.media_id,
    detectionId: Number(detection.detection_id),
    individualId: null,
    category: detection.category,
    type: detection.annotation_type ?? null,
    data: detection.data,
    source: detection.type,
    score: detection.score,
    updatedAt: new Date(detection.created_at ?? 0),
  } as Annotation
}

function toReviewMedia(
  media: Media,
  claimExpiresAt: Date
): Pick<Media, "id" | "src" | "exif"> {
  const token = createMediaCapability(media.id, claimExpiresAt)
  return {
    id: media.id,
    src: `/api/media/${media.id}?token=${encodeURIComponent(token)}`,
    exif: media.exif,
  }
}

function toFeaturePoints(values: number[][]): [number, number][] {
  return values.map(([x, y]) => [x!, y!])
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
    Resource.SubmissionReviewPipeline.table,
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
    Resource.SubmissionReviewPipeline.table,
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
      acc.src = media.uri.key
    }
    if (cur.sk.startsWith("detection")) {
      const detection = cur as DetectionItem

      const newAnnotation = {
        id: `$${randomBytes(10).toString("hex")}`,
        mediaId: detection.media_id,
        detectionId: Number(detection.detection_id),
        individualId: null,
        category: detection.category,
        type: detection.annotation_type ?? null,
        data: detection.data,
        source: detection.type,
        score: detection.score,
        updatedAt: new Date(detection.created_at ?? 0),
      } as Annotation
      acc.annotations = acc.annotations
        ? [...acc.annotations, newAnnotation]
        : [newAnnotation]
    }
    return acc
  }, { state: "pending" } as Media)
}

/*
export async function getDetection(key: string): Promise<DetectionResponse> {
  const { body, metadata } = await getObject(Resource.Uploads.name, key)
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
    Resource.SubmissionReviewPipeline.table,
    key
  )
  return { type, category, data, score }
}

export async function getDetections(key: {
  pk: string
}): Promise<Partial<DetectionItem>[]> {
  const { items } = await queryItems<DetectionItem>(
    Resource.SubmissionReviewPipeline.table,
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
