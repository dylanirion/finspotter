"use server"

import { headers } from "next/headers"
import { can } from "@finspotter/core/auth/permissions"
import { type Sort, type Where } from "@finspotter/core/database"
import { createIdentificationService } from "@finspotter/core/identification"
import { createIndividualRepository } from "@finspotter/core/individual"
import {
  createNamesRepository,
  type IndividualName,
} from "@finspotter/core/name"
import { getSession } from "lib/auth"

const { findOne, findAll } = createIndividualRepository()
const { findOne: findOneName } = createNamesRepository()
const identification = createIdentificationService()

async function requireIdentificationWriter() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user || !can(session.user, "update", "Annotation"))
    throw new Error("Unauthorized access.")
}

export async function identifyEncounter(
  annotationId: string,
  individualId: string | null
) {
  await requireIdentificationWriter()
  return identification.identifyEncounter(annotationId, individualId)
}

export async function createIndividualForEncounter(
  annotationId: string,
  name?: Omit<IndividualName, "individualId">
) {
  await requireIdentificationWriter()
  return identification.createIndividualForEncounter(annotationId, name)
}

export async function setIndividualName(name: IndividualName) {
  await requireIdentificationWriter()
  await identification.setName(name)
}

export async function removeIndividualName(name: IndividualName) {
  await requireIdentificationWriter()
  await identification.removeName(name)
}

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
