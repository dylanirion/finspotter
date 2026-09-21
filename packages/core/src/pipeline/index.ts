import { type AnnotationDataTypes } from "@finspotter/annotations"
import {
  type AnnotationTypes,
  type DetectConfig,
  type DetectionFunction,
  type ExtractConfig,
  type ExtractionFunction,
  type MatchRefinementFunction,
  type RefineConfig,
  type SearchConfig,
  type SearchFunction,
} from "@finspotter/config/pipeline"

export type PipelineStatus =
  | "submitted"
  | "initialised"
  | "detecting"
  | "extracting"
  | "searching (pairwise)"
  | "searching (indexed)"
  | "succeeded"
  | "failed"

export type StatusItem = {
  pk: string
  sk: string
  gsi1pk: string
  created_at: string
  status: PipelineStatus
}

export type MediaItem = {
  pk: string
  sk: string
  media_id: string
  type: string
  created_at?: string
  superseded_by?: string
  uri: {
    bucket: string
    key: string
  }
}

type DetectionDataType<D extends string | undefined> =
  D extends keyof AnnotationTypes
    ? AnnotationDataTypes[AnnotationTypes[D]]
    : unknown

export type DetectionItem<D extends string = string> = {
  pk: string
  sk: string
  media_id: string
  detection_id: number
  type: D
  category: string
  data: DetectionDataType<D>
  score: number
  created_at?: string
  superseded_by?: string
  uri: {
    bucket: string
    key: string
  }
}

export type MediaResponse = {
  created_at: string
  media_id: string
  type: string
  superseded_by: string
  uri: {
    bucket: string
    key: string
  }
}

export type DetectionResponse<
  D extends string = string,
> = {
  type: D
  category: string
  data: DetectionDataType<D>
  score: number
}

type ExtractionDataType<E extends string | undefined> =
  E extends keyof AnnotationTypes
    ? AnnotationDataTypes[AnnotationTypes[E]]
    : unknown

export type ExtractionResponse<
  E extends string = string,
> = {
  data: ExtractionDataType<E>
}

type RefinementWithConfig<F extends string> = {
  functionName: string
  config: F extends MatchRefinementFunction ? RefineConfig<F> | null : unknown
}

type RefineArray<R extends string[]> = {
  [K in keyof R]: R[K] extends string
    ? RefinementWithConfig<R[K]>
    : never
}

type S3Object = {
  bucket: string
  key: string
}

type DynamoItem = {
  sk: string
  pk: string
}

type DetectPayload = DynamoItem & S3Object & { media_id: string }
type ExtractPayload = DynamoItem &
  S3Object & { media_id: string; detection_id: string }
type SearchPayload = ExtractPayload
type RefinePayload = DynamoItem & S3Object

type Step = "detect" | "extract" | "search" | "refine"

type PayloadFor<E extends Step> = E extends "detect"
  ? DetectPayload
  : E extends "extract"
    ? ExtractPayload
    : E extends "search"
      ? SearchPayload
      : E extends "refine"
        ? RefinePayload
        : never

type InferEntry<D, E, S, R> = D extends string
  ? "detect"
  : E extends string
    ? "extract"
    : S extends string
      ? "search"
      : R extends string[]
        ? "refine"
        : never

export interface JobProps<
  D extends string | undefined,
  E extends string | undefined = undefined,
  S extends string | undefined = undefined,
  R extends string[] | undefined = undefined,
> {
  submissionId: string
  payload: PayloadFor<InferEntry<D, E, S, R>>[]
  detect?: D extends string
    ? {
        functionName: string
        config: D extends DetectionFunction ? DetectConfig<D> | null : unknown
      }
    : undefined
  extract?: E extends string
    ? {
        functionName: string
        config: E extends ExtractionFunction ? ExtractConfig<E> | null : unknown
      }
    : undefined
  search?: {
    type: "pairwise" | "indexed"
    functionName: string
    config: S extends SearchFunction ? SearchConfig<S> | null : unknown
  }
  refine?: R extends string[] ? RefineArray<R> : undefined
  expires: number | null
}

export interface PipelineRun {
  id: string
  startedAt: Date
}

export interface PipelineRepository {
  startJob<
    D extends string | undefined = undefined,
    E extends string | undefined = undefined,
    S extends string | undefined = undefined,
    R extends string[] | undefined = undefined,
  >(input: JobProps<D, E, S, R>): Promise<PipelineRun>
}