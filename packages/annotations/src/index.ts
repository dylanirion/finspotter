import { annotations, type AnnotationMachines } from "./annotations.config"
import { machine as nullMachine } from "./null/machine"
import {
  createAnnotationRegistry,
  type AnnotationDataMap,
  type AnnotationDisplayMap,
  type AnnotationName,
} from "./registry"

const registry = createAnnotationRegistry(annotations)

export const AnnotationTypes = registry.types
export type AnnotationType = AnnotationName<typeof annotations>
export type AnnotationDataTypes = AnnotationDataMap<typeof annotations>
export type AnnotationDisplayTypes = AnnotationDisplayMap<typeof annotations>

type AnnotationMachineTypes = AnnotationMachines & {
  null: typeof nullMachine
}

export type MachineType<T extends AnnotationType | "null"> =
  AnnotationMachineTypes[T]

export function materializeAnnotation<T extends AnnotationType>(
  type: T,
  data: AnnotationDataTypes[T]
) {
  return registry.materialize(type, data)
}
