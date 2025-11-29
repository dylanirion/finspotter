"use server"

import { headers } from "next/headers"
import {
  createAnnotationRepository,
  type Annotation,
} from "@finspotter/core/annotation"
import { can } from "@finspotter/core/auth/permissions"
import { type Sort, type Where } from "@finspotter/core/database"
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
  //TODO: check permissions? inject filter based on permissions
  return await findAll({ limit, offset, where, sort })
}

export async function getSingleAnnotation(id: string) {
  return await findOne({ id: id })
}

//TODO: for superuser, these should write annotation straight to db then trigger pipeline for features only with auto_review
//  for others we submit manual detection to pipeline for feature extraction.
// do we need something like can(session?.user, "auto_review", "Annotation")

//TODO: media editor should show unreviewed annotations
//TODO: also need a query to list and run pipeline for annotations without features?

export async function updateAnnotation(annotation: Annotation) {
  const session = await getSession({ headers: await headers() })

  //TODO: check actual permissions
  if (!session?.user) {
    throw new Error("Unauthenticated request.")
  }
  annotation.createdBy = session.user.id

  const [result] = await update({
    //TODO: QC annotation, ensure order, etc
    ...annotation,
    createdBy: session.user.id,
  })
  if (!result.affectedRows) throw new Error("No rows affected")
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
          userContributed: session?.user.id,
        }) as PartialBy<Annotation, "id">
    )
  )
  if (result.length !== annotations.length)
    throw new Error(
      `Error inserting ${annotations.length - result.length} rows`
    )
  return result
}

export async function deleteAnnotation(id: string | number) {
  const session = await getSession({ headers: await headers() })

  //TODO: check if user can delete THIS annotation
  if (!session?.user || !can(session?.user, "delete", "Annotation"))
    throw new Error("Unauthorized access.")

  const [result] = await remove({ id: id })
  if (!result.affectedRows) throw new Error("No rows affected")
}
