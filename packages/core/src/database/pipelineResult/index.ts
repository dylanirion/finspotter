import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm"

import { db } from "../_drizzle"
import {
  pipelineResultLinksTable,
  pipelineResultsTable,
} from "./sql"

export type PipelineResult = typeof pipelineResultsTable.$inferSelect
export type PipelineResultKind = PipelineResult["kind"]
export type PipelineReviewStatus = PipelineResult["reviewStatus"]
export type PipelineResultRelation =
  typeof pipelineResultLinksTable.$inferInsert.relation

export type PipelineResultLinkInput = {
  relation: PipelineResultRelation
  relatedSourceSystem?: string
  relatedSourcePk: string
  relatedSourceSk: string
}

export type PipelineResultProjection = {
  sourceSystem?: string
  sourcePk: string
  sourceSk: string
  kind: PipelineResultKind
  submissionId: string
  mediaId?: string | null
  payload: Record<string, unknown>
  sourceCreatedAt?: Date | null
  expiresAt?: Date | null
  supersededBy?: string | null
  final?: boolean
  reviewStatus?: PipelineReviewStatus
  reviewScore?: number | null
  reviewReadyAt?: Date | null
  reviewedBy?: string | null
  reviewedAt?: Date | null
  annotationId?: string | null
  links?: PipelineResultLinkInput[]
}

export type PipelineReviewCursor = {
  score: number
  readyAt: Date
  id: string
}

export type PipelineReviewDecision = "approved" | "rejected" | "inferred"

export interface PipelineResultRepository {
  project(result: PipelineResultProjection): Promise<PipelineResult>
  findReviewReady(
    limit: number,
    cursor?: PipelineReviewCursor
  ): Promise<{ items: PipelineResult[]; cursor?: PipelineReviewCursor }>
  claim(
    id: string,
    reviewerId: string,
    leaseDurationMs?: number
  ): Promise<PipelineResult | null>
  decide(
    id: string,
    reviewerId: string,
    decision: PipelineReviewDecision,
    annotationId?: string | null
  ): Promise<PipelineResult | null>
}

export function createPipelineResultRepository(): PipelineResultRepository {
  return {
    async project(result) {
      const now = new Date()
      const [projected] = await db
        .insert(pipelineResultsTable)
        .values({
          sourceSystem: result.sourceSystem ?? "dynamodb",
          sourcePk: result.sourcePk,
          sourceSk: result.sourceSk,
          kind: result.kind,
          submissionId: result.submissionId,
          mediaId: result.mediaId,
          payload: result.payload,
          sourceCreatedAt: result.sourceCreatedAt,
          expiresAt: result.expiresAt,
          supersededBy: result.supersededBy,
          final: result.final ?? false,
          reviewStatus: result.reviewStatus ?? "pending",
          reviewScore: result.reviewScore,
          reviewReadyAt: result.reviewReadyAt,
          reviewedBy: result.reviewedBy,
          reviewedAt: result.reviewedAt,
          annotationId: result.annotationId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            pipelineResultsTable.sourceSystem,
            pipelineResultsTable.sourcePk,
            pipelineResultsTable.sourceSk,
          ],
          set: {
            kind: sql`excluded.kind`,
            submissionId: sql`excluded.submission_id`,
            mediaId: sql`excluded.media_id`,
            payload: sql`excluded.payload`,
            sourceCreatedAt: sql`excluded.source_created_at`,
            expiresAt: sql`excluded.expires_at`,
            supersededBy: sql`excluded.superseded_by`,
            final: sql`excluded.final`,
            reviewScore: sql`excluded.review_score`,
            reviewReadyAt: sql`excluded.review_ready_at`,
            reviewStatus: sql`case
              when ${pipelineResultsTable.reviewStatus} in ('claimed', 'approved', 'rejected', 'inferred')
                then ${pipelineResultsTable.reviewStatus}
              else excluded.review_status
            end`,
            reviewedBy: sql`case
              when ${pipelineResultsTable.reviewStatus} in ('claimed', 'approved', 'rejected', 'inferred')
                then ${pipelineResultsTable.reviewedBy}
              else excluded.reviewed_by
            end`,
            reviewedAt: sql`case
              when ${pipelineResultsTable.reviewStatus} in ('claimed', 'approved', 'rejected', 'inferred')
                then ${pipelineResultsTable.reviewedAt}
              else excluded.reviewed_at
            end`,
            annotationId: sql`case
              when ${pipelineResultsTable.reviewStatus} in ('claimed', 'approved', 'rejected', 'inferred')
                then ${pipelineResultsTable.annotationId}
              else excluded.annotation_id
            end`,
            updatedAt: now,
          },
        })
        .returning()

      if (!projected) throw new Error("Failed to project pipeline result")

      if (result.links?.length) {
        await db
          .insert(pipelineResultLinksTable)
          .values(
            result.links.map((link) => ({
              resultId: projected.id,
              relation: link.relation,
              relatedSourceSystem:
                link.relatedSourceSystem ?? result.sourceSystem ?? "dynamodb",
              relatedSourcePk: link.relatedSourcePk,
              relatedSourceSk: link.relatedSourceSk,
            }))
          )
          .onConflictDoNothing()
      }

      return projected
    },

    async findReviewReady(limit, cursor) {
      const now = new Date()
      const cursorCondition = cursor
        ? or(
            lt(pipelineResultsTable.reviewScore, cursor.score),
            and(
              eq(pipelineResultsTable.reviewScore, cursor.score),
              gt(pipelineResultsTable.reviewReadyAt, cursor.readyAt)
            ),
            and(
              eq(pipelineResultsTable.reviewScore, cursor.score),
              eq(pipelineResultsTable.reviewReadyAt, cursor.readyAt),
              gt(pipelineResultsTable.id, cursor.id)
            )
          )
        : undefined
      const items = await db
        .select()
        .from(pipelineResultsTable)
        .where(
          and(
            or(
              eq(pipelineResultsTable.reviewStatus, "ready"),
              and(
                eq(pipelineResultsTable.reviewStatus, "claimed"),
                lt(pipelineResultsTable.claimExpiresAt, now)
              )
            ),
            isNotNull(pipelineResultsTable.reviewScore),
            isNotNull(pipelineResultsTable.reviewReadyAt),
            cursorCondition
          )
        )
        .orderBy(
          desc(pipelineResultsTable.reviewScore),
          asc(pipelineResultsTable.reviewReadyAt),
          asc(pipelineResultsTable.id)
        )
        .limit(Math.max(1, Math.min(limit, 100)))
      const last = items.at(-1)

      return {
        items,
        ...(last?.reviewScore !== null && last?.reviewReadyAt
          ? {
              cursor: {
                score: last.reviewScore,
                readyAt: last.reviewReadyAt,
                id: last.id,
              },
            }
          : {}),
      }
    },

    async claim(id, reviewerId, leaseDurationMs = 5 * 60 * 1000) {
      const now = new Date()
      const claimExpiresAt = new Date(now.getTime() + leaseDurationMs)
      const [claimed] = await db
        .update(pipelineResultsTable)
        .set({
          reviewStatus: "claimed",
          claimedBy: reviewerId,
          claimExpiresAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(pipelineResultsTable.id, id),
            or(
              eq(pipelineResultsTable.reviewStatus, "ready"),
              and(
                eq(pipelineResultsTable.reviewStatus, "claimed"),
                lt(pipelineResultsTable.claimExpiresAt, now)
              )
            )
          )
        )
        .returning()

      return claimed ?? null
    },

    async decide(id, reviewerId, decision, annotationId) {
      const now = new Date()
      const [decided] = await db
        .update(pipelineResultsTable)
        .set({
          reviewStatus: decision,
          reviewedBy: reviewerId,
          reviewedAt: now,
          annotationId,
          claimExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(pipelineResultsTable.id, id),
            eq(pipelineResultsTable.reviewStatus, "claimed"),
            eq(pipelineResultsTable.claimedBy, reviewerId),
            or(
              gt(pipelineResultsTable.claimExpiresAt, now),
              eq(pipelineResultsTable.claimExpiresAt, now)
            ),
            inArray(pipelineResultsTable.kind, [
              "media",
              "detection",
              "extraction",
              "pair",
              "indexed_match",
            ])
          )
        )
        .returning()

      return decided ?? null
    },
  }
}
