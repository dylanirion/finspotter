/** Augmented by each detection extension via `declare module` */
export interface DetectionRegistry {}

/** Augmented by each extraction extension */
export interface ExtractionRegistry {}

/** Augmented by each search extension */
export interface SearchRegistry {}

/** Augmented by each refinement extension */
export interface RefinementRegistry {}

/** Augmented by detection extensions that produce annotations */
export interface AnnotationTypes {}

// Derived types
export type DetectionFunction = keyof DetectionRegistry
export type ExtractionFunction = keyof ExtractionRegistry
export type SearchFunction = keyof SearchRegistry
export type MatchRefinementFunction = keyof RefinementRegistry

export type DetectConfig<D extends DetectionFunction | undefined> =
  D extends DetectionFunction ? DetectionRegistry[D]["config"] : never

export type ExtractConfig<E extends ExtractionFunction | undefined> =
  E extends ExtractionFunction ? ExtractionRegistry[E]["config"] : never

export type SearchConfig<S extends SearchFunction | undefined> =
  S extends SearchFunction ? SearchRegistry[S]["config"] : never

export type RefineConfig<R extends MatchRefinementFunction | undefined> =
  R extends MatchRefinementFunction ? RefinementRegistry[R]["config"] : never