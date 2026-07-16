import { type AnnotationDataTypes, type AnnotationType } from "./index"

export type Annotation = {
  [T in AnnotationType]: {
    id: string
    mediaId: string
    detectionId: number
    source: string | null
    category: string | null
    type: T | null
    data: AnnotationDataTypes[T] | null
    score: number | null
    updatedAt: Date
    createdBy?: string
  }
}[AnnotationType]
