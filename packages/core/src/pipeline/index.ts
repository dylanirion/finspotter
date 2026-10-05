import "server-only"

import { type AnnotationDataTypes } from "@finspotter/annotations"
import type { MaterializationPlan } from "@finspotter/annotations/materialization"
import {
  type AnnotationTypes,
  type DetectConfig,
  type DetectionFunction,
  type ExtractConfig,
  type ExtractionFunction,
  type MatchRefinementFunction,
  type RefineConfig,
  type SearchConfig,
  type SearchFunction,
} from "@finspotter/config/pipeline"

import { createStorageRepository, type StorageRepository } from "../storage"

export {
  createPairJobKey,
  type ExtractionReference,
  type PairJobItem,
  type PairJobState,
} from "./pairs"

export type PipelineStatus =
  | "submitted"
  | "initialised"
  | "detecting"
  | "materializing"
  | "extracting"
  | "searching (pairwise)"
  | "searching (indexed)"
  | "succeeded"
  | "failed"

export type SubmissionLifecycleState =
  | "draft"
  | "closing"
  | "processing"
  | "reviewable"
  | "completed"
  | "failed"

export type MediaUploadState = "registered" | "uploaded" | "failed" | "removed"

export type MediaProcessingState =
  | "pending"
  | "running"
  | "succeeded"
  | "partially_succeeded"
  | "failed"

export type SubmissionLifecycleItem = {
  pk: string
  sk: "submission"
  item_type: "submission"
  state: SubmissionLifecycleState
  created_at: string
  updated_at: string
  closed_at?: string
}

export type StatusItem = {
  pk: string
  sk: string
  gsi1pk: string
  created_at: string
  status: PipelineStatus
}

export type MediaItem = {
  pk: string
  sk: string
  item_type?: "media"
  media_id: string
  type: string
  accepted?: boolean
  upload_status?: MediaUploadState
  processing_status?: MediaProcessingState
  created_at?: string
  uploaded_at?: string
  updated_at?: string
  superseded_by?: string
  uri: {
    bucket: string
    key: string
  }
}

type DetectionDataType<D extends string | undefined> =
  D extends keyof AnnotationTypes
    ? AnnotationDataTypes[AnnotationTypes[D]]
    : unknown

export type DetectionItem<D extends string = string> = {
  pk: string
  sk: string
  media_id: string
  detection_id: number
  source: D
  type: keyof AnnotationDataTypes
  category: string
  data: DetectionDataType<D>
  score: number
  created_at?: string
  superseded_by?: string
  uri: {
    bucket: string
    key: string
  }
}

export type MediaResponse = {
  created_at: string
  media_id: string
  type: string
  superseded_by: string
  uri: {
    bucket: string
    key: string
  }
}

export type DetectionResponse<D extends string = string> = {
  source: D
  type: keyof AnnotationDataTypes
  category: string
  data: DetectionDataType<D>
  score: number
}

type ExtractionDataType<E extends string | undefined> =
  E extends keyof AnnotationTypes
    ? AnnotationDataTypes[AnnotationTypes[E]]
    : unknown

export type ExtractionResponse<E extends string = string> = {
  data: ExtractionDataType<E>
}

type RefinementWithConfig<F extends string> = {
  functionName: string
  config: F extends MatchRefinementFunction ? RefineConfig<F> | null : unknown
}

type RefineArray<R extends string[]> = {
  [K in keyof R]: R[K] extends string ? RefinementWithConfig<R[K]> : never
}

type S3Object = {
  bucket: string
  key: string
}

type DynamoItem = {
  sk: string
  pk: string
}

type DetectPayload = DynamoItem & S3Object & { media_id: string }
type ExtractPayload = DynamoItem &
  S3Object & {
    media_id: string
    detection_id: string
    materialization?: MaterializationPlan
    autoReview?: {
      annotationId: string
      reviewedBy: string
      reviewedAt: string
    }
  }
type SearchPayload = ExtractPayload
type RefinePayload = DynamoItem & S3Object

type Step = "detect" | "extract" | "search" | "refine"

type PayloadFor<E extends Step> = E extends "detect"
  ? DetectPayload
  : E extends "extract"
    ? ExtractPayload
    : E extends "search"
      ? SearchPayload
      : E extends "refine"
        ? RefinePayload
        : never

type InferEntry<D, E, S, R> = D extends string
  ? "detect"
  : E extends string
    ? "extract"
    : S extends string
      ? "search"
      : R extends string[]
        ? "refine"
        : never

export interface JobProps<
  D extends string | undefined,
  E extends string | undefined = undefined,
  S extends string | undefined = undefined,
  R extends string[] | undefined = undefined,
> {
  submissionId: string
  payload: PayloadFor<InferEntry<D, E, S, R>>[]
  pairsPrepared?: boolean
  reconcileProcessing?: boolean
  reportProgress?: boolean
  detect?: D extends string
    ? {
        functionName: string
        config: D extends DetectionFunction ? DetectConfig<D> | null : unknown
      }
    : undefined
  extract?: E extends string
    ? {
        functionName: string
        config: E extends ExtractionFunction ? ExtractConfig<E> | null : unknown
      }
    : undefined
  search?: {
    type: "pairwise" | "indexed"
    functionName: string
    config: S extends SearchFunction ? SearchConfig<S> | null : unknown
  }
  refine?: R extends string[] ? RefineArray<R> : undefined
  expires: number | null
}

export interface PipelineRun {
  id: string
  startedAt: Date
}

export interface PipelineRepository {
  startJob<
    D extends string | undefined = undefined,
    E extends string | undefined = undefined,
    S extends string | undefined = undefined,
    R extends string[] | undefined = undefined,
  >(
    input: JobProps<D, E, S, R>
  ): Promise<PipelineRun>
}

export interface RegisterMediaInput {
  submissionId: string
  mediaId: string
  type: string
  uri: {
    bucket: string
    key: string
  }
}

export interface CloseSubmissionResult {
  media: MediaItem[]
  ready: boolean
}

export interface PipelineLifecycleRepository {
  registerSubmission(submissionId: string): Promise<void>
  registerMedia(input: RegisterMediaInput): Promise<void>
  completeMediaUpload(submissionId: string, mediaId: string): Promise<MediaItem>
  setMediaUri(
    submissionId: string,
    mediaId: string,
    uri: MediaItem["uri"]
  ): Promise<void>
  claimMediaProcessing(submissionId: string, mediaId: string): Promise<boolean>
  failMediaProcessingStart(submissionId: string, mediaId: string): Promise<void>
  completeMediaProcessing(
    submissionId: string,
    mediaId: string,
    status?: "succeeded" | "partially_succeeded"
  ): Promise<void>
  closeSubmission(
    submissionId: string,
    acceptedMediaIds: string[]
  ): Promise<CloseSubmissionResult>
}

export function createPipelineLifecycleRepository({
  table,
  storage = createStorageRepository(),
}: {
  table: string
  storage?: StorageRepository
}): PipelineLifecycleRepository {
  return {
    async registerSubmission(submissionId) {
      const now = new Date().toISOString()
      await storage.updateItem(table, {
        Key: { pk: submissionId, sk: "submission" },
        ExpressionAttributeNames: {
          "#ITEMTYPE": "item_type",
          "#STATE": "state",
          "#CREATEDAT": "created_at",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":itemType": "submission",
          ":state": "draft",
          ":now": now,
        },
        UpdateExpression:
          "SET #ITEMTYPE = if_not_exists(#ITEMTYPE, :itemType), #STATE = if_not_exists(#STATE, :state), #CREATEDAT = if_not_exists(#CREATEDAT, :now), #UPDATEDAT = :now",
      })
    },

    async registerMedia({ submissionId, mediaId, type, uri }) {
      const now = new Date().toISOString()
      await storage.updateItem(table, {
        Key: { pk: submissionId, sk: `media#${mediaId}` },
        ExpressionAttributeNames: {
          "#ITEMTYPE": "item_type",
          "#TYPE": "type",
          "#ACCEPTED": "accepted",
          "#UPLOADSTATUS": "upload_status",
          "#PROCESSINGSTATUS": "processing_status",
          "#URI": "uri",
          "#GSI1PK": "gsi1pk",
          "#CREATEDAT": "created_at",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":itemType": "media",
          ":mediaId": mediaId,
          ":type": type,
          ":accepted": true,
          ":uploadStatus": "registered",
          ":processingStatus": "pending",
          ":uri": uri,
          ":gsi1pk": "result",
          ":now": now,
        },
        UpdateExpression:
          "SET #ITEMTYPE = if_not_exists(#ITEMTYPE, :itemType), media_id = if_not_exists(media_id, :mediaId), #TYPE = :type, #ACCEPTED = if_not_exists(#ACCEPTED, :accepted), #UPLOADSTATUS = if_not_exists(#UPLOADSTATUS, :uploadStatus), #PROCESSINGSTATUS = if_not_exists(#PROCESSINGSTATUS, :processingStatus), #URI = :uri, #GSI1PK = if_not_exists(#GSI1PK, :gsi1pk), #CREATEDAT = if_not_exists(#CREATEDAT, :now), #UPDATEDAT = :now",
      })
    },

    async completeMediaUpload(submissionId, mediaId) {
      const key = { pk: submissionId, sk: `media#${mediaId}` }
      const media = await storage.getItem<MediaItem>(table, key)
      if (media.item_type !== "media" || !media.accepted) {
        throw new Error(
          `Media ${mediaId} is not eligible for upload completion`
        )
      }

      const object = await storage.getHead(media.uri.bucket, media.uri.key)
      if (!object.size) {
        throw new Error(`Uploaded media ${mediaId} is empty`)
      }
      if (object.contentType !== media.type) {
        throw new Error(
          `Uploaded media ${mediaId} has content type ${object.contentType ?? "unknown"}; expected ${media.type}`
        )
      }

      const now = new Date().toISOString()
      await storage.updateItem(table, {
        Key: key,
        ConditionExpression:
          "#ITEMTYPE = :itemType AND #ACCEPTED = :accepted AND (#UPLOADSTATUS = :registered OR #UPLOADSTATUS = :uploaded)",
        ExpressionAttributeNames: {
          "#ITEMTYPE": "item_type",
          "#ACCEPTED": "accepted",
          "#UPLOADSTATUS": "upload_status",
          "#UPLOADEDAT": "uploaded_at",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":itemType": "media",
          ":accepted": true,
          ":registered": "registered",
          ":uploaded": "uploaded",
          ":now": now,
        },
        UpdateExpression:
          "SET #UPLOADSTATUS = :uploaded, #UPLOADEDAT = if_not_exists(#UPLOADEDAT, :now), #UPDATEDAT = :now",
      })

      return { ...media, upload_status: "uploaded", uploaded_at: now }
    },

    async setMediaUri(submissionId, mediaId, uri) {
      const now = new Date().toISOString()
      await storage.updateItem(table, {
        Key: { pk: submissionId, sk: `media#${mediaId}` },
        ConditionExpression:
          "#ACCEPTED = :accepted AND #UPLOADSTATUS = :uploaded",
        ExpressionAttributeNames: {
          "#ACCEPTED": "accepted",
          "#UPLOADSTATUS": "upload_status",
          "#URI": "uri",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":accepted": true,
          ":uploaded": "uploaded",
          ":uri": uri,
          ":now": now,
        },
        UpdateExpression: "SET #URI = :uri, #UPDATEDAT = :now",
      })
    },

    async claimMediaProcessing(submissionId, mediaId) {
      try {
        const now = new Date().toISOString()
        await storage.updateItem(table, {
          Key: { pk: submissionId, sk: `media#${mediaId}` },
          ConditionExpression:
            "#ACCEPTED = :accepted AND #UPLOADSTATUS = :uploaded AND (#PROCESSINGSTATUS = :pending OR #PROCESSINGSTATUS = :failed)",
          ExpressionAttributeNames: {
            "#ACCEPTED": "accepted",
            "#UPLOADSTATUS": "upload_status",
            "#PROCESSINGSTATUS": "processing_status",
            "#PROCESSINGSTARTEDAT": "processing_started_at",
            "#UPDATEDAT": "updated_at",
          },
          ExpressionAttributeValues: {
            ":accepted": true,
            ":uploaded": "uploaded",
            ":pending": "pending",
            ":running": "running",
            ":failed": "failed",
            ":now": now,
          },
          UpdateExpression:
            "SET #PROCESSINGSTATUS = :running, #PROCESSINGSTARTEDAT = :now, #UPDATEDAT = :now",
        })
        return true
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "ConditionalCheckFailedException"
        )
          return false
        throw error
      }
    },

    async failMediaProcessingStart(submissionId, mediaId) {
      const now = new Date().toISOString()
      await storage.updateItem(table, {
        Key: { pk: submissionId, sk: `media#${mediaId}` },
        ConditionExpression: "#PROCESSINGSTATUS = :running",
        ExpressionAttributeNames: {
          "#PROCESSINGSTATUS": "processing_status",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":running": "running",
          ":failed": "failed",
          ":now": now,
        },
        UpdateExpression: "SET #PROCESSINGSTATUS = :failed, #UPDATEDAT = :now",
      })
    },

    async completeMediaProcessing(submissionId, mediaId, status = "succeeded") {
      const now = new Date().toISOString()
      await storage.updateItem(table, {
        Key: { pk: submissionId, sk: `media#${mediaId}` },
        ConditionExpression:
          "#ACCEPTED = :accepted AND #UPLOADSTATUS = :uploaded",
        ExpressionAttributeNames: {
          "#ACCEPTED": "accepted",
          "#UPLOADSTATUS": "upload_status",
          "#PROCESSINGSTATUS": "processing_status",
          "#PROCESSINGCOMPLETEDAT": "processing_completed_at",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":accepted": true,
          ":uploaded": "uploaded",
          ":status": status,
          ":now": now,
        },
        UpdateExpression:
          "SET #PROCESSINGSTATUS = :status, #PROCESSINGCOMPLETEDAT = :now, #UPDATEDAT = :now",
      })
    },

    async closeSubmission(submissionId, acceptedMediaIds) {
      const accepted = new Set(acceptedMediaIds)
      if (!accepted.size)
        throw new Error("A submission requires at least one media item")

      const { items } = await storage.queryItems<MediaItem>(table, {
        pk: submissionId,
        sk: { operator: "starts_with", value: "media#" },
      })
      const byId = new Map(items.map((item) => [item.media_id, item]))
      const missing = acceptedMediaIds.filter((id) => !byId.has(id))
      if (missing.length) {
        throw new Error(
          `Submission contains unregistered media: ${missing.join(", ")}`
        )
      }

      const incompleteUploads = acceptedMediaIds.filter(
        (id) => byId.get(id)?.upload_status !== "uploaded"
      )
      if (incompleteUploads.length) {
        throw new Error(
          `Submission contains incomplete uploads: ${incompleteUploads.join(", ")}`
        )
      }

      const now = new Date().toISOString()
      await Promise.all(
        items.map((item) =>
          storage.updateItem(table, {
            Key: { pk: submissionId, sk: item.sk },
            ExpressionAttributeNames: {
              "#ACCEPTED": "accepted",
              ...(!accepted.has(item.media_id) && {
                "#UPLOADSTATUS": "upload_status",
              }),
              "#UPDATEDAT": "updated_at",
            },
            ExpressionAttributeValues: {
              ":accepted": accepted.has(item.media_id),
              ...(!accepted.has(item.media_id) && { ":removed": "removed" }),
              ":now": now,
            },
            UpdateExpression: accepted.has(item.media_id)
              ? "SET #ACCEPTED = :accepted, #UPDATEDAT = :now"
              : "SET #ACCEPTED = :accepted, #UPLOADSTATUS = :removed, #UPDATEDAT = :now",
          })
        )
      )

      const removedMedia = items.filter(
        ({ media_id }) => !accepted.has(media_id)
      )
      // TODO: suppress artifacts written after close by already-running jobs.
      await Promise.all(
        removedMedia.map(async ({ media_id }) => {
          const { items: artifacts } = await storage.queryItems<{
            pk: string
            sk: string
          }>(table, { media_id }, undefined, "gsi2", undefined, [
            "media_id",
            "sk",
          ])
          await Promise.all(
            artifacts.map((artifact) =>
              storage.updateItem(table, {
                Key: { pk: artifact.pk, sk: artifact.sk },
                ExpressionAttributeNames: {
                  "#GSI1PK": "gsi1pk",
                  "#EXCLUDEDAT": "excluded_at",
                },
                ExpressionAttributeValues: {
                  ":now": now,
                },
                UpdateExpression: "REMOVE #GSI1PK SET #EXCLUDEDAT = :now",
              })
            )
          )
        })
      )

      await storage.updateItem(table, {
        Key: { pk: submissionId, sk: "submission" },
        ConditionExpression: "#STATE = :draft OR #STATE = :closing",
        ExpressionAttributeNames: {
          "#STATE": "state",
          "#ACCEPTEDMEDIAIDS": "accepted_media_ids",
          "#CLOSEDAT": "closed_at",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":draft": "draft",
          ":closing": "closing",
          ":acceptedMediaIds": [...accepted],
          ":now": now,
        },
        UpdateExpression:
          "SET #STATE = :closing, #ACCEPTEDMEDIAIDS = :acceptedMediaIds, #CLOSEDAT = if_not_exists(#CLOSEDAT, :now), #UPDATEDAT = :now",
      })

      const media = acceptedMediaIds.map((id) => ({
        ...byId.get(id)!,
        accepted: true,
      }))
      return {
        media,
        ready: media.every(({ processing_status }) =>
          ["succeeded", "partially_succeeded"].includes(
            processing_status ?? "pending"
          )
        ),
      }
    },
  }
}
