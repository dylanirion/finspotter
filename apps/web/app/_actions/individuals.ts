"use server"

import { can } from "@finspotter/core/auth/permissions"
import { type Sort, type Where } from "@finspotter/core/database"
import { createIndividualRepository } from "@finspotter/core/individual"
import { createNamesRepository } from "@finspotter/core/name"

const { findOne, findAll } = createIndividualRepository()
const { findOne: findOneName } = createNamesRepository()

export async function getAllIndividuals({
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
  return await findAll({ limit, offset, sort, where })
}

export async function getSingleIndividual(id: string) {
  return await findOne({ id: id })
}

export async function getCanonicalNames(id: string) {
  return await findOneName({ individualId: id, type: "canonical" })
}
