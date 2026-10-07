import "server-only"

import { db, type DatabaseClient } from "../database/_drizzle"
import { createAnnotationRepository } from "../database/annotation"
import { createIndividualRepository } from "../database/individual"
import { createNamesRepository, type IndividualName } from "../database/name"

export function createIdentificationService(client: DatabaseClient = db) {
  const annotations = createAnnotationRepository(client)
  const names = createNamesRepository(client)

  return {
    async identifyEncounter(annotationId: string, individualId: string | null) {
      const annotation = await annotations.findOne({ id: annotationId })
      if (!annotation) throw new Error(`Annotation ${annotationId} not found`)

      await annotations.update({
        id: annotation.id,
        updatedAt: annotation.updatedAt,
        individualId,
      })
      return { annotationId, individualId }
    },

    async createIndividualForEncounter(
      annotationId: string,
      name?: Omit<IndividualName, "individualId">
    ) {
      return client.transaction(async (tx) => {
        const [individual] = await createIndividualRepository(tx).insert([{}])
        if (!individual?.id) throw new Error("Failed to create individual")
        await createIdentificationService(tx).identifyEncounter(
          annotationId,
          individual.id
        )
        if (name)
          await createNamesRepository(tx).insert([
            { ...name, individualId: individual.id },
          ])
        return { annotationId, individualId: individual.id }
      })
    },

    async setName(name: IndividualName) {
      await names.insert([name])
    },

    async removeName(name: IndividualName) {
      await names.remove(name)
    },
  }
}
