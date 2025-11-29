import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn"
import { type AnnotationDataTypes } from "@finspotter/annotations"
import { Resource } from "sst"

import {
  MatchRefinementFunction,
  type AnnotationTypes,
  type DetectConfig,
  type DetectionFunction,
  type ExtractConfig,
  type ExtractionFunction,
  type RefineConfig,
  type SearchConfig,
  type SearchFunction,
} from "./index"

export type StatusItem = {
  pk: string
  sk: string
  gsi1pk: string
  created_at: string
  status: string
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

type DetectionDataType<D extends DetectionFunction | undefined> =
  D extends keyof AnnotationTypes
    ? AnnotationDataTypes[AnnotationTypes[D]]
    : never

export type DetectionItem<D extends DetectionFunction = DetectionFunction> = {
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

export type DetectionResponse<D extends DetectionFunction = DetectionFunction> =
  {
    type: D
    category: string
    data: DetectionDataType<D>
    score: number
  }

type ExtractionDataType<E extends ExtractionFunction | undefined> =
  E extends keyof AnnotationTypes
    ? AnnotationDataTypes[AnnotationTypes[E]]
    : never

export type ExtractionResponse<
  E extends ExtractionFunction = ExtractionFunction,
> = {
  data: ExtractionDataType<E>
}

type RefinementWithConfig<F extends MatchRefinementFunction> = {
  functionName: string
  config: RefineConfig<F> | null
}

type RefineArray<R extends MatchRefinementFunction[]> = {
  [K in keyof R]: R[K] extends MatchRefinementFunction
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

// Define step types
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

type InferEntry<D, E, S, R> = D extends DetectionFunction
  ? "detect"
  : E extends ExtractionFunction
    ? "extract"
    : S extends SearchFunction
      ? "search"
      : R extends MatchRefinementFunction[]
        ? "refine"
        : never

export interface JobProps<
  D extends DetectionFunction | undefined,
  E extends ExtractionFunction | undefined = undefined,
  S extends SearchFunction | undefined = undefined,
  R extends MatchRefinementFunction[] | undefined = undefined,
> {
  submissionId: string
  payload: PayloadFor<InferEntry<D, E, S, R>>[]
  detect?: D extends DetectionFunction
    ? {
        functionName: string
        config: DetectConfig<D> | null
      }
    : undefined
  extract?: E extends ExtractionFunction
    ? {
        functionName: string
        config: ExtractConfig<E> | null
      }
    : undefined
  search?: {
    type: "pairwise" | "indexed"
    functionName: string
    config: SearchConfig<S> | null
  }
  refine?: R extends MatchRefinementFunction[] ? RefineArray<R> : undefined
  expires: Number | null
}

const sfn = new SFNClient({
  logger: {
    ...console,
    debug(..._args) {},
    trace(..._args) {},
  },
})

export async function invoke<
  D extends DetectionFunction | undefined = undefined,
  E extends ExtractionFunction | undefined = undefined,
  S extends SearchFunction | undefined = undefined,
  R extends MatchRefinementFunction[] | undefined = undefined,
>(input: JobProps<D, E, S, R>) {
  const arn = Resource.ImageProcessingPipeline.pipeline
  const command = new StartExecutionCommand({
    stateMachineArn: arn,
    input: JSON.stringify(input),
  })
  const response = await sfn.send(command)
  return response.$metadata.httpStatusCode
}
