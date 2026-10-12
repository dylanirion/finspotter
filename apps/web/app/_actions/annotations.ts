"use server"

import { headers } from "next/headers"
import {
  createAnnotationRepository,
  type Annotation,
} from "@finspotter/core/annotation"
import { can } from "@finspotter/core/auth/permissions"
import { type Sort, type Where } from "@finspotter/core/database"
import {
  removeAnnotationFromIndexes,
  startAutoReviewedExtractions,
} from "lib/annotationIndex"
import { getSession } from "lib/auth"
import { type PartialBy } from "lib/utils"

const { findOne, findAll, update, insert, remove } =
  createAnnotationRepository()

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

  const updated = await update({
    //TODO: QC annotation, ensure order, etc
    ...annotation,
    createdBy: session.user.id,
  })
  await removeAnnotationFromIndexes(annotation.id)
  if (can(session.user, "auto_review", "Annotation")) {
    await startAutoReviewedExtractions([annotation], updated, session.user.id)
  }
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

export async function deleteAnnotation(id: string) {
  const session = await getSession({ headers: await headers() })

  //TODO: check if user can delete THIS annotation
  if (!session?.user || !can(session?.user, "delete", "Annotation"))
    throw new Error("Unauthorized access.")

  await removeAnnotationFromIndexes(id)
  const removed = await remove({ id })
  if (removed.length === 0) throw new Error("No rows affected")
}
