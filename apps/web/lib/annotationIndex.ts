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

export async function removeAnnotationFromIndexes(id: string) {
  const pipeline: unknown = Resource.SimilaritySearchPipeline
  if (
    typeof pipeline !== "object" ||
    pipeline === null ||
    !("removeFunctions" in pipeline) ||
    typeof pipeline.removeFunctions !== "object" ||
    pipeline.removeFunctions === null
  ) {
    throw new Error("No indexed search removal functions are configured")
  }
  const removeFunctions = Object.values(pipeline.removeFunctions)
  if (
    removeFunctions.length === 0 ||
    !removeFunctions.every(
      (value): value is string => typeof value === "string"
    )
  ) {
    throw new Error("Invalid indexed search removal function configuration")
  }

  await Promise.all(
    removeFunctions.map((functionName) =>
      invokePipelineFunction(functionName, { id })
    )
  )
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
