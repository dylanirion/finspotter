"use server"

import { randomUUID } from "crypto"
import { headers } from "next/headers"
import { materializeAnnotation } from "@finspotter/annotations"
import {
  createAnnotationRepository,
  type Annotation,
} from "@finspotter/core/annotation"
import { can } from "@finspotter/core/auth/permissions"
import { type Sort, type Where } from "@finspotter/core/database"
import { createMediaRepository } from "@finspotter/core/media"
import { createStorageRepository } from "@finspotter/core/storage"
import { invokeMediaPipeline } from "@finspotter/pipeline/invoke"
import { getSession } from "lib/auth"
import { type PartialBy } from "lib/utils"
import { Resource } from "sst"

const { findOne, findAll, update, insert, remove } =
  createAnnotationRepository()
const { findMany: findMedia } = createMediaRepository()
const { putItem } = createStorageRepository()

export async function getAllAnnotations({
  limit = 10,
  offset = 0,
  where = {},
  sort = [],
}: {
  limit: number
  offset: number
  where?: Where
  sort?: Sort
}) {
  await requireMediaReader()
  return await findAll({ limit, offset, where, sort })
}

export async function getSingleAnnotation(id: string) {
  await requireMediaReader()
  return await findOne({ id: id })
}

async function requireMediaReader() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user || !can(session.user, "read", "Media"))
    throw new Error("Unauthorized access.")
}

//TODO: media editor should show unreviewed annotations
//TODO: also need a query to list and run pipeline for annotations without features?

export async function updateAnnotation(annotation: Annotation) {
  const session = await getSession({ headers: await headers() })

  //TODO: check actual permissions
  if (!session?.user) {
    throw new Error("Unauthenticated request.")
  }
  annotation.createdBy = session.user.id

  await update({
    //TODO: QC annotation, ensure order, etc
    ...annotation,
    createdBy: session.user.id,
  })
}

export async function insertAnnotations(
  annotations: PartialBy<Annotation, "id" | "data">[]
) {
  const session = await getSession({ headers: await headers() })

  //TODO: this should maybe check media?
  //TODO: figure out can on new user shape
  if (!session?.user || !can(session?.user, "create", "Annotation"))
    throw new Error("Unauthorized access.")

  const result = await insert(
    annotations.map(
      (annotation) =>
        ({
          ...annotation,
          ...((!annotation.data || !annotation.type) && {
            data: null,
            type: null,
          }),
          createdBy: session.user.id,
        }) as PartialBy<Annotation, "id">
    )
  )
  if (result.length !== annotations.length)
    throw new Error(
      `Error inserting ${annotations.length - result.length} rows`
    )
  if (can(session.user, "auto_review", "Annotation")) {
    await startAutoReviewedExtractions(annotations, result, session.user.id)
  }

  return result
}

async function startAutoReviewedExtractions(
  annotations: PartialBy<Annotation, "id" | "data">[],
  inserted: Awaited<ReturnType<typeof insert>>,
  reviewerId: string
) {
  const media = await findMedia({
    id: {
      operator: "in",
      value: [...new Set(inserted.map(({ mediaId }) => mediaId))],
    },
  })
  const mediaById = new Map((media ?? []).map((item) => [item.id, item]))

  await Promise.all(
    inserted.map(async (created, index) => {
      const annotation = annotations[index]
      const sourceMedia = mediaById.get(created.mediaId)
      if (
        !annotation ||
        annotation.source !== "manual" ||
        !annotation.type ||
        !annotation.data ||
        !annotation.category ||
        !created.updatedAt ||
        !sourceMedia
      )
        return

      const submissionId = randomUUID()
      const sk = `detection#${created.mediaId}#${created.detectionId}#manual`
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
        source: "manual",
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

export async function deleteAnnotation(id: string) {
  const session = await getSession({ headers: await headers() })

  //TODO: check if user can delete THIS annotation
  if (!session?.user || !can(session?.user, "delete", "Annotation"))
    throw new Error("Unauthorized access.")

  const removed = await remove({ id })
  if (removed.length === 0) throw new Error("No rows affected")
}
