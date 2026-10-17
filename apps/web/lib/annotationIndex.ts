import { randomUUID } from "crypto"
import { materializeAnnotation } from "@finspotter/annotations"
import {
  createAnnotationRepository,
  type Annotation,
} from "@finspotter/core/annotation"
import { createMediaRepository } from "@finspotter/core/media"
import { createStorageRepository } from "@finspotter/core/storage"
import {
  invokeMediaPipeline,
  invokePipelineFunction,
} from "@finspotter/pipeline/invoke"
import { Resource } from "sst"

type PersistedAnnotation = Pick<
  Annotation,
  "id" | "mediaId" | "detectionId"
> & { updatedAt: Date | null }
type ExtractionAnnotation = Pick<
  Annotation,
  "source" | "category" | "type" | "score"
> &
  Partial<Pick<Annotation, "data">>

const { findMany: findMedia } = createMediaRepository()
const { putItem } = createStorageRepository()

function getIndexFunctions(
  property: "addFunctions" | "removeFunctions",
  operation: string
) {
  const pipeline: unknown = Resource.SimilaritySearchPipeline
  if (typeof pipeline !== "object" || pipeline === null) {
    throw new Error(`No indexed search ${operation} functions are configured`)
  }
  const configured = (
    pipeline as Partial<
      Record<"addFunctions" | "removeFunctions", Record<string, unknown>>
    >
  )[property]
  if (typeof configured !== "object" || configured === null) {
    throw new Error(`No indexed search ${operation} functions are configured`)
  }
  const functions = Object.values(configured)
  if (
    functions.length === 0 ||
    !functions.every((value): value is string => typeof value === "string")
  ) {
    throw new Error(
      `Invalid indexed search ${operation} function configuration`
    )
  }
  return functions
}

export async function removeAnnotationFromIndexes(id: string) {
  await invokeIndexFunctions(
    getIndexFunctions("removeFunctions", "removal"),
    { id },
    "remove annotation from"
  )
}

export async function addExtractionToIndexes({
  annotationId,
  type,
  category,
  bucket,
  key,
}: {
  annotationId: string
  type: string
  category: string
  bucket: string
  key: string
}) {
  await invokeIndexFunctions(
    getIndexFunctions("addFunctions", "add"),
    {
      id: annotationId,
      type,
      category,
      bucket,
      key,
    },
    "add extraction to"
  )
}

async function invokeIndexFunctions(
  functions: string[],
  payload: unknown,
  operation: string
) {
  const results = await Promise.allSettled(
    functions.map((functionName) =>
      invokePipelineFunction(functionName, payload)
    )
  )
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  )
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to ${operation} ${failures.length} indexed search extension${failures.length === 1 ? "" : "s"}.`
    )
  }
}

export async function startAutoReviewedExtractions(
  annotations: ExtractionAnnotation[],
  persisted: PersistedAnnotation[],
  reviewerId: string
) {
  const media = await findMedia({
    id: {
      operator: "in",
      value: [...new Set(persisted.map(({ mediaId }) => mediaId))],
    },
  })
  const mediaById = new Map((media ?? []).map((item) => [item.id, item]))

  await Promise.all(
    persisted.map(async (created, index) => {
      const annotation = annotations[index]
      const sourceMedia = mediaById.get(created.mediaId)
      if (
        !annotation ||
        !annotation.source ||
        !annotation.type ||
        !annotation.data ||
        !annotation.category ||
        !created.updatedAt ||
        !sourceMedia
      )
        return

      const submissionId = randomUUID()
      const sk = `detection#${created.mediaId}#${created.detectionId}#${annotation.source}`
      const materialization = materializeAnnotation(
        annotation.type,
        annotation.data
      )
      const reviewedAt = new Date().toISOString()
      const payload = {
        pk: submissionId,
        sk,
        media_id: created.mediaId,
        detection_id: String(created.detectionId),
        bucket: Resource.Uploads.name,
        key: sourceMedia.src,
        materialization,
        autoReview: {
          annotationId: created.id,
          reviewedBy: reviewerId,
          reviewedAt,
        },
      }

      await putItem(Resource.SubmissionReviewPipeline.table, {
        pk: submissionId,
        sk,
        item_type: "detection",
        media_id: created.mediaId,
        detection_id: String(created.detectionId),
        source: annotation.source,
        type: annotation.type,
        category: annotation.category,
        data: annotation.data,
        score: annotation.score ?? 1,
        uri: {
          bucket: Resource.Uploads.name,
          key: sourceMedia.src,
        },
        materialization,
        gsi1pk: "result",
        created_at: created.updatedAt.toISOString(),
      })

      await invokeMediaPipeline<undefined, "hesaff">({
        submissionId,
        payload: [payload],
        extract: {
          functionName:
            Resource.MediaProcessingPipeline.extractionFunctions.hesaff,
          config: null,
        },
        reportProgress: false,
        expires: null,
      })
    })
  )
}

export async function startAutoReviewedExtractionForAnnotation(
  id: string,
  reviewerId: string
) {
  const annotation = await createAnnotationRepository().findOne({ id })
  if (!annotation) throw new Error(`Annotation ${id} not found`)
  await startAutoReviewedExtractions([annotation], [annotation], reviewerId)
}
