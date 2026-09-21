import "server-only"

import { createAnnotationRepository } from "../database/annotation"
import { createNamesRepository, type IndividualName } from "../database/name"

export function createIdentificationService() {
  const annotations = createAnnotationRepository()
  const names = createNamesRepository()

  return {
    async identifyEncounter(annotationId: string, individualId: string | null) {
      const annotation = await annotations.findOne({ id: annotationId })
      if (!annotation) throw new Error(`Annotation ${annotationId} not found`)

      const { media: _, ...encounter } = annotation
      await annotations.update({ ...encounter, individualId })
    },

    async setName(name: IndividualName) {
      await names.insert([name])
    },

    async removeName(name: IndividualName) {
      await names.remove(name)
    },
  }
}
