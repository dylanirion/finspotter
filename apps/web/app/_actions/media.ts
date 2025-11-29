"use server"

import { type Sort, type Where } from "@finspotter/core/database"
import { createMediaRepository } from "@finspotter/core/media"

const { findOne, findAll } = createMediaRepository()

export async function getAllMedia({
  limit = 10,
  offset = 0,
  sort = [],
  where = {},
}: {
  limit: number
  offset: number
  sort?: Sort
  where?: Where
}) {
  //TODO: check permissions? inject filter based on permissions
  return await findAll({
    limit,
    offset,
    sort,
    where,
  })
}

//TODO: query and append annotations under review from pipeline
// think this requires a second index on media_id in pipeline table
export async function getSingleMedia(id: string) {
  return await findOne({ id: id })
}
