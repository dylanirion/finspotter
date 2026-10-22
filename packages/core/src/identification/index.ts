import "server-only"

import { and, eq, inArray, ne, or } from "drizzle-orm"

import { db, type DatabaseClient } from "../database/_drizzle"
import { adoptionsTable } from "../database/adoption/sql"
import { annotationsTable } from "../database/annotation/sql"
import {
  comparisonComponents,
  comparisonObservationKey,
  hasDifferentIdentityConflict,
  parseComparisonObservationKey,
} from "../database/comparisonDecision/graph"
import { comparisonDecisionsTable } from "../database/comparisonDecision/sql"
import { detectionsTable } from "../database/detection/sql"
import {
  individualRedirectsTable,
  individualsTable,
} from "../database/individual/sql"
import { createIndividualSummaryRepository } from "../database/individualSummary"
import { mediaTable } from "../database/media/sql"
import { createNamesRepository, type IndividualName } from "../database/name"
import { namesTable } from "../database/name/sql"
import { tagsTable } from "../database/tag/sql"

export type IdentificationObservation = {
  annotationId: string
  mediaId: string
  detectionId: number
  src: string
  category: string | null
  individualId: string | null
}

export type AwaitingIdentificationGroup = {
  id: string
  observations: IdentificationObservation[]
  individualIds: string[]
  hasConflict: boolean
  hasDifferentConflict: boolean
}

export function createIdentificationService(client: DatabaseClient = db) {
  const names = createNamesRepository(client)

  return {
    async identifyEncounter(
      annotationId: string,
      individualId: string | null,
      reviewerId: string
    ) {
      const [annotation] = await client
        .select({
          id: annotationsTable.id,
          mediaId: annotationsTable.mediaId,
          detectionId: annotationsTable.detectionId,
          individualId: annotationsTable.individualId,
        })
        .from(annotationsTable)
        .where(eq(annotationsTable.id, annotationId))
        .limit(1)
      if (!annotation) throw new Error(`Annotation ${annotationId} not found`)

      if (individualId) {
        const assigned = await this.assignProvisionalGroup(
          {
            mediaId: annotation.mediaId,
            detectionId: annotation.detectionId,
          },
          individualId,
          reviewerId
        )
        return { annotationId, individualId: assigned.individualId }
      }

      return client.transaction(async (tx) => {
        const decisions = await tx.select().from(comparisonDecisionsTable)
        const component = comparisonComponents(decisions).componentFor(
          comparisonObservationKey(annotation.mediaId, annotation.detectionId)
        )
        const keys = [...component.members].map(parseComparisonObservationKey)
        const conditions = or(
          ...keys.map(({ mediaId, detectionId }) =>
            and(
              eq(annotationsTable.mediaId, mediaId),
              eq(annotationsTable.detectionId, detectionId)
            )
          )
        )
        const linkedAnnotations = await tx
          .select({
            id: annotationsTable.id,
            individualId: annotationsTable.individualId,
          })
          .from(annotationsTable)
          .where(conditions)
          .orderBy(annotationsTable.id)
          .for("update")
        await tx
          .update(annotationsTable)
          .set({ individualId: null })
          .where(conditions)
        await createIndividualSummaryRepository().refresh(
          [
            ...new Set(
              linkedAnnotations.flatMap(({ individualId: currentId }) =>
                currentId ? [currentId] : []
              )
            ),
          ],
          tx
        )
        return { annotationId, individualId: null }
      })
    },

    async createIndividualForEncounter(
      annotationId: string,
      reviewerId: string,
      name?: Omit<IndividualName, "individualId">
    ) {
      const [annotation] = await client
        .select({
          mediaId: annotationsTable.mediaId,
          detectionId: annotationsTable.detectionId,
        })
        .from(annotationsTable)
        .where(eq(annotationsTable.id, annotationId))
        .limit(1)
      if (!annotation) throw new Error(`Annotation ${annotationId} not found`)
      const identity = await this.assignProvisionalGroup(
        annotation,
        null,
        reviewerId,
        false,
        name
      )
      return { annotationId, individualId: identity.individualId }
    },

    async findAwaitingIdentification(): Promise<AwaitingIdentificationGroup[]> {
      const [observations, decisions] = await Promise.all([
        client
          .select({
            annotationId: annotationsTable.id,
            mediaId: annotationsTable.mediaId,
            detectionId: annotationsTable.detectionId,
            src: mediaTable.src,
            category: detectionsTable.category,
            individualId: annotationsTable.individualId,
          })
          .from(annotationsTable)
          .innerJoin(
            detectionsTable,
            and(
              eq(detectionsTable.mediaId, annotationsTable.mediaId),
              eq(detectionsTable.detectionId, annotationsTable.detectionId),
              eq(detectionsTable.createdAt, annotationsTable.updatedAt)
            )
          )
          .innerJoin(mediaTable, eq(mediaTable.id, annotationsTable.mediaId))
          .where(ne(mediaTable.state, "rejected")),
        client.select().from(comparisonDecisionsTable),
      ])

      const graph = comparisonComponents(decisions)
      const groups = new Map<string, AwaitingIdentificationGroup>()
      const membersByGroup = new Map<string, Set<string>>()
      for (const observation of observations) {
        const key = comparisonObservationKey(
          observation.mediaId,
          observation.detectionId
        )
        const component = graph.componentFor(key)
        let group = groups.get(component.id)
        if (!group) {
          group = {
            id: component.id,
            observations: [],
            individualIds: [],
            hasConflict: component.hasDifferentConflict,
            hasDifferentConflict: component.hasDifferentConflict,
          }
          groups.set(component.id, group)
          membersByGroup.set(component.id, component.members)
        }
        group.observations.push(observation)
        if (
          observation.individualId &&
          !group.individualIds.includes(observation.individualId)
        ) {
          group.individualIds.push(observation.individualId)
        }
      }

      for (const group of groups.values()) {
        if (!group.individualIds.length) continue
        const assignedMembers = new Set(
          observations
            .filter(
              ({ individualId }) =>
                individualId && group.individualIds.includes(individualId)
            )
            .map(({ mediaId, detectionId }) =>
              comparisonObservationKey(mediaId, detectionId)
            )
        )
        group.hasDifferentConflict ||= hasDifferentIdentityConflict(
          decisions,
          membersByGroup.get(group.id) ?? new Set(),
          assignedMembers
        )
        if (group.hasDifferentConflict) group.hasConflict = true
      }

      return [...groups.values()]
        .filter(
          (group) =>
            group.hasDifferentConflict ||
            group.individualIds.length > 1 ||
            group.observations.some(({ individualId }) => !individualId)
        )
        .map((group) => ({
          ...group,
          hasConflict: group.hasConflict || group.individualIds.length > 1,
          observations: group.observations.sort(
            (a, b) =>
              a.mediaId.localeCompare(b.mediaId) ||
              a.detectionId - b.detectionId
          ),
          individualIds: group.individualIds.sort(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    },

    async resolveIndividualId(id: string) {
      return resolveIndividualId(client, id)
    },

    async assignProvisionalGroup(
      seed: { mediaId: string; detectionId: number },
      targetIndividualId: string | null,
      reviewerId: string,
      mergeExisting = false,
      newIndividualName?: Omit<IndividualName, "individualId">
    ) {
      return client.transaction(async (tx) => {
        const decisions = await tx.select().from(comparisonDecisionsTable)
        const graph = comparisonComponents(decisions)
        const component = graph.componentFor(
          comparisonObservationKey(seed.mediaId, seed.detectionId)
        )
        if (component.hasDifferentConflict)
          throw new Error(
            "This provisional group contains a conflicting 'different' decision and needs review."
          )

        const memberKeys = [...component.members]
        const members = memberKeys.map(parseComparisonObservationKey)
        const condition = or(
          ...members.map(({ mediaId, detectionId }) =>
            and(
              eq(annotationsTable.mediaId, mediaId),
              eq(annotationsTable.detectionId, detectionId)
            )
          )
        )
        const groupAnnotations = await tx
          .select({
            id: annotationsTable.id,
            individualId: annotationsTable.individualId,
            mediaId: annotationsTable.mediaId,
            detectionId: annotationsTable.detectionId,
          })
          .from(annotationsTable)
          .where(condition)
          .orderBy(annotationsTable.id)
          .for("update")
        if (!groupAnnotations.length)
          throw new Error("The provisional identity group has no annotations.")
        if (
          !groupAnnotations.some(
            ({ mediaId, detectionId }) =>
              mediaId === seed.mediaId && detectionId === seed.detectionId
          )
        ) {
          throw new Error("The selected observation is no longer available.")
        }

        const mediaIds = [
          ...new Set(groupAnnotations.map(({ mediaId }) => mediaId)),
        ]
        const reviewedMedia = await tx
          .select({ id: mediaTable.id })
          .from(mediaTable)
          .where(
            and(
              inArray(mediaTable.id, mediaIds),
              ne(mediaTable.state, "rejected")
            )
          )
          .orderBy(mediaTable.id)
          .for("update")
        if (reviewedMedia.length !== mediaIds.length)
          throw new Error("Rejected media cannot be assigned an identity.")

        const existingIds = [
          ...new Set(
            groupAnnotations.flatMap(({ individualId }) =>
              individualId ? [individualId] : []
            )
          ),
        ].sort()
        let targetId = targetIndividualId
        let mergedIndividualIds: string[] = []

        if (existingIds.length > 1) {
          if (!mergeExisting || !targetId || !existingIds.includes(targetId))
            throw new Error(
              "Choose one of this group's existing individuals to keep when merging."
            )
          mergedIndividualIds = existingIds.filter((id) => id !== targetId)
        } else if (existingIds.length === 1) {
          if (!targetId) {
            throw new Error(
              "This group already has an individual. Choose that identity or explicitly merge."
            )
          }
          if (targetId !== existingIds[0] && !mergeExisting)
            throw new Error(
              "Assigning a different existing individual requires a group merge."
            )
          if (targetId !== existingIds[0])
            mergedIndividualIds = [existingIds[0]]
        } else if (!targetId) {
          const [individual] = await tx
            .insert(individualsTable)
            .values({})
            .returning({ id: individualsTable.id })
          if (!individual) throw new Error("Failed to create individual.")
          targetId = individual.id
          if (newIndividualName)
            await createNamesRepository(tx).insert([
              { ...newIndividualName, individualId: targetId },
            ])
        }

        const identityIds = [...new Set([...existingIds, targetId])]
        const lockedIndividuals = await tx
          .select({
            id: individualsTable.id,
            comments: individualsTable.comments,
          })
          .from(individualsTable)
          .where(inArray(individualsTable.id, identityIds))
          .orderBy(individualsTable.id)
          .for("update")
        if (lockedIndividuals.length !== identityIds.length)
          throw new Error("An individual in this group no longer exists.")
        const target = lockedIndividuals.find(({ id }) => id === targetId)
        if (!target) throw new Error("The selected individual does not exist.")

        const assignmentIds = [...new Set([...existingIds, targetId])]
        const assignedObservations = await tx
          .select({
            mediaId: annotationsTable.mediaId,
            detectionId: annotationsTable.detectionId,
          })
          .from(annotationsTable)
          .where(inArray(annotationsTable.individualId, assignmentIds))
        const assignedMembers = new Set(
          assignedObservations.map(({ mediaId, detectionId }) =>
            comparisonObservationKey(mediaId, detectionId)
          )
        )
        if (
          hasDifferentIdentityConflict(
            decisions,
            component.members,
            assignedMembers
          )
        ) {
          throw new Error(
            "A confirmed 'different' decision conflicts with the selected individual identity."
          )
        }

        if (mergedIndividualIds.length) {
          const mergedIndividuals = await tx
            .select({
              id: individualsTable.id,
              comments: individualsTable.comments,
            })
            .from(individualsTable)
            .where(inArray(individualsTable.id, mergedIndividualIds))
          const comments = [
            target.comments,
            ...mergedIndividuals.flatMap(({ id, comments: value }) =>
              value ? [`Merged from ${id}:\n${value}`] : []
            ),
          ].filter((value): value is string => !!value)
          if (comments.length) {
            await tx
              .update(individualsTable)
              .set({ comments: comments.join("\n\n") })
              .where(eq(individualsTable.id, targetId))
          }

          const oldNames = await tx
            .select({
              organizationId: namesTable.organizationId,
              type: namesTable.type,
              value: namesTable.value,
            })
            .from(namesTable)
            .where(inArray(namesTable.individualId, mergedIndividualIds))
          if (oldNames.length) {
            await tx
              .insert(namesTable)
              .values(
                oldNames.map((name) => ({
                  ...name,
                  individualId: targetId!,
                }))
              )
              .onConflictDoNothing()
          }
          await tx
            .delete(namesTable)
            .where(inArray(namesTable.individualId, mergedIndividualIds))

          const oldTags = await tx
            .select({ serialNumber: tagsTable.serialNumber })
            .from(tagsTable)
            .where(inArray(tagsTable.individualId, mergedIndividualIds))
          if (oldTags.length) {
            await tx
              .insert(tagsTable)
              .values(
                oldTags.map(({ serialNumber }) => ({
                  serialNumber,
                  individualId: targetId!,
                }))
              )
              .onConflictDoNothing()
          }
          await tx
            .delete(tagsTable)
            .where(inArray(tagsTable.individualId, mergedIndividualIds))
          await tx
            .update(adoptionsTable)
            .set({ individualId: targetId })
            .where(inArray(adoptionsTable.individualId, mergedIndividualIds))
          await tx
            .update(annotationsTable)
            .set({ individualId: targetId })
            .where(inArray(annotationsTable.individualId, mergedIndividualIds))
          await tx
            .update(individualRedirectsTable)
            .set({ targetId })
            .where(
              inArray(individualRedirectsTable.targetId, mergedIndividualIds)
            )
          await tx.insert(individualRedirectsTable).values(
            mergedIndividualIds.map((sourceId) => ({
              sourceId,
              targetId: targetId!,
              mergedBy: reviewerId,
            }))
          )
        }

        await tx
          .update(annotationsTable)
          .set({ individualId: targetId })
          .where(
            inArray(
              annotationsTable.id,
              groupAnnotations.map(({ id }) => id)
            )
          )

        if (mergedIndividualIds.length) {
          await tx
            .delete(individualsTable)
            .where(inArray(individualsTable.id, mergedIndividualIds))
        }
        await createIndividualSummaryRepository().refresh([targetId], tx)

        return { individualId: targetId, mergedIndividualIds }
      })
    },

    async setName(name: IndividualName) {
      const individualId = await resolveIndividualId(client, name.individualId)
      await names.insert([{ ...name, individualId }])
    },

    async removeName(name: IndividualName) {
      const individualId = await resolveIndividualId(client, name.individualId)
      await names.remove({ ...name, individualId })
    },
  }
}

async function resolveIndividualId(client: DatabaseClient, id: string) {
  const visited = new Set<string>()
  let currentId = id
  while (true) {
    if (visited.has(currentId))
      throw new Error("Individual merge redirects contain a cycle.")
    visited.add(currentId)
    const [redirect] = await client
      .select({ targetId: individualRedirectsTable.targetId })
      .from(individualRedirectsTable)
      .where(eq(individualRedirectsTable.sourceId, currentId))
      .limit(1)
    if (!redirect) return currentId
    currentId = redirect.targetId
  }
}
