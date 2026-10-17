import { and, eq, or, sql } from "drizzle-orm"

import { db } from "../_drizzle"
import { comparisonDecisionsTable } from "./sql"

export type ComparisonDecision = typeof comparisonDecisionsTable.$inferSelect
export type ComparisonVerdict = ComparisonDecision["verdict"]
export type ComparisonDecisionSource = ComparisonDecision["source"]

export type ComparisonObservation = {
  mediaId: string
  detectionId: number
}

export type ComparisonPair = {
  query: ComparisonObservation
  reference: ComparisonObservation
}

export type CanonicalComparisonPair = {
  aMediaId: string
  aDetectionId: number
  bMediaId: string
  bDetectionId: number
}

export type ComparisonDecisionInput = CanonicalComparisonPair & {
  resultId?: string | null
  source: ComparisonDecisionSource
  verdict: ComparisonVerdict
  score?: number | null
  decidedBy: string
}

/**
 * Orders the two observations deterministically so that the same unordered
 * comparison always maps to one row, regardless of which side a candidate
 * generator considered the query.
 */
export function canonicalizeComparisonPair(
  pair: ComparisonPair
): CanonicalComparisonPair {
  const { query, reference } = pair
  const queryFirst =
    query.mediaId === reference.mediaId
      ? query.detectionId <= reference.detectionId
      : query.mediaId < reference.mediaId
  const [a, b] = queryFirst ? [query, reference] : [reference, query]
  return {
    aMediaId: a.mediaId,
    aDetectionId: a.detectionId,
    bMediaId: b.mediaId,
    bDetectionId: b.detectionId,
  }
}

export function comparisonPairCondition(pair: CanonicalComparisonPair) {
  return and(
    eq(comparisonDecisionsTable.aMediaId, pair.aMediaId),
    eq(comparisonDecisionsTable.aDetectionId, pair.aDetectionId),
    eq(comparisonDecisionsTable.bMediaId, pair.bMediaId),
    eq(comparisonDecisionsTable.bDetectionId, pair.bDetectionId)
  )
}

export function comparisonDecisionValues(input: ComparisonDecisionInput) {
  const now = new Date()
  return {
    values: {
      resultId: input.resultId ?? null,
      source: input.source,
      aMediaId: input.aMediaId,
      aDetectionId: input.aDetectionId,
      bMediaId: input.bMediaId,
      bDetectionId: input.bDetectionId,
      verdict: input.verdict,
      score: input.score ?? null,
      decidedBy: input.decidedBy,
      decidedAt: now,
      updatedAt: now,
    },
    conflict: {
      target: [
        comparisonDecisionsTable.aMediaId,
        comparisonDecisionsTable.aDetectionId,
        comparisonDecisionsTable.bMediaId,
        comparisonDecisionsTable.bDetectionId,
      ],
      set: {
        resultId: sql`excluded.result_id`,
        source: sql`excluded.source`,
        verdict: sql`excluded.verdict`,
        score: sql`excluded.score`,
        decidedBy: sql`excluded.decided_by`,
        decidedAt: sql`excluded.decided_at`,
        updatedAt: now,
      },
    },
  }
}

export interface ComparisonDecisionRepository {
  record(input: ComparisonDecisionInput): Promise<ComparisonDecision>
  findForPair(pair: ComparisonPair): Promise<ComparisonDecision | null>
  findForObservation(
    observation: ComparisonObservation,
    verdict?: ComparisonVerdict
  ): Promise<ComparisonDecision[]>
}

export function createComparisonDecisionRepository(): ComparisonDecisionRepository {
  return {
    async record(input) {
      const { values, conflict } = comparisonDecisionValues(input)
      const [recorded] = await db
        .insert(comparisonDecisionsTable)
        .values(values)
        .onConflictDoUpdate(conflict)
        .returning()
      if (!recorded) throw new Error("Failed to record comparison decision")
      return recorded
    },

    async findForPair(pair) {
      const [decision] = await db
        .select()
        .from(comparisonDecisionsTable)
        .where(comparisonPairCondition(canonicalizeComparisonPair(pair)))
        .limit(1)
      return decision ?? null
    },

    async findForObservation(observation, verdict) {
      return db
        .select()
        .from(comparisonDecisionsTable)
        .where(
          and(
            or(
              and(
                eq(comparisonDecisionsTable.aMediaId, observation.mediaId),
                eq(
                  comparisonDecisionsTable.aDetectionId,
                  observation.detectionId
                )
              ),
              and(
                eq(comparisonDecisionsTable.bMediaId, observation.mediaId),
                eq(
                  comparisonDecisionsTable.bDetectionId,
                  observation.detectionId
                )
              )
            ),
            verdict ? eq(comparisonDecisionsTable.verdict, verdict) : undefined
          )
        )
    },
  }
}
