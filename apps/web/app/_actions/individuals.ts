"use server"

import { headers } from "next/headers"
import { can } from "@finspotter/core/auth/permissions"
import { type Sort, type Where } from "@finspotter/core/database"
import { createIdentificationService } from "@finspotter/core/identification"
import {
  createIndividualRepository,
  type IndividualSummary,
} from "@finspotter/core/individual"
import {
  createNamesRepository,
  type IndividualName,
} from "@finspotter/core/name"
import { getSession } from "lib/auth"
import { signedMediaUrl } from "lib/mediaAccess"
import { z } from "zod"

const { findOne, findAll } = createIndividualRepository()
const { findOne: findOneName } = createNamesRepository()
const identification = createIdentificationService()

async function requireIdentificationWriter() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user || !can(session.user, "update", "Annotation"))
    throw new Error("Unauthorized access.")
  return session.user.id
}

export async function identifyEncounter(
  annotationId: string,
  individualId: string | null
) {
  const reviewerId = await requireIdentificationWriter()
  return identification.identifyEncounter(
    annotationId,
    individualId,
    reviewerId
  )
}

export async function createIndividualForEncounter(
  annotationId: string,
  name?: Omit<IndividualName, "individualId">
) {
  const reviewerId = await requireIdentificationWriter()
  return identification.createIndividualForEncounter(
    annotationId,
    reviewerId,
    name
  )
}

export async function getAwaitingIdentification() {
  await requireIdentificationWriter()
  const groups = await identification.findAwaitingIdentification()
  return groups.map((group) => ({
    ...group,
    observations: group.observations.map((observation) => ({
      ...observation,
      src: signedMediaUrl(observation.mediaId),
    })),
  }))
}

export async function assignProvisionalIdentity(
  mediaId: string,
  detectionId: number,
  targetIndividualId: string | null,
  mergeExisting = false
) {
  const reviewerId = await requireIdentificationWriter()
  const parsedMediaId = z.uuid().parse(mediaId)
  const parsedDetectionId = z.number().int().positive().parse(detectionId)
  const parsedTargetId =
    targetIndividualId === null ? null : z.uuid().parse(targetIndividualId)
  return identification.assignProvisionalGroup(
    { mediaId: parsedMediaId, detectionId: parsedDetectionId },
    parsedTargetId,
    reviewerId,
    z.boolean().parse(mergeExisting)
  )
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
  const result = await findAll({ limit, offset, sort, where })
  if (!result) return result
  return {
    ...result,
    items: result.items.map((individual) => ({
      ...individual,
      // Summary `src` is the representative media ID.
      src: individual.src ? signedMediaUrl(individual.src) : null,
    })),
  }
}

export async function getIndividualsForAssignment(): Promise<
  IndividualSummary[]
> {
  await requireIdentificationWriter()
  const result = await findAll({
    limit: 500,
    offset: 0,
    sort: [],
    where: {},
  })
  if (!result) throw new Error("Unable to load individuals for assignment.")
  return result.items
}

export async function getSingleIndividual(id: string) {
  const individual = await findOne({
    id: await identification.resolveIndividualId(id),
  })
  if (!individual) return individual
  return {
    ...individual,
    encounters: individual.encounters.map((encounter) => ({
      ...encounter,
      // Replaces the storage key with a URL the client can render.
      media: {
        ...encounter.media,
        src: signedMediaUrl(encounter.media.id),
      },
    })),
  }
}

export async function getCanonicalNames(id: string) {
  return await findOneName({
    individualId: await identification.resolveIndividualId(id),
    type: "canonical",
  })
}
