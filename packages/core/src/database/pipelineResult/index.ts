import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm"

import { type Annotation } from "../annotation"
import {
  annotationsIncrementerTable,
  annotationsTable,
} from "../annotation/sql"
import { db } from "../_drizzle"
import { detectionsTable } from "../detection/sql"
import { createIndividualSummaryRepository } from "../individualSummary"
import { mediaTable } from "../media/sql"
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
  score: number | null
  readyAt: Date
  id: string
}

export type PipelineReviewDecision = "approved" | "rejected" | "inferred"
export type DetectionApproval = Omit<
  Annotation,
  "id" | "detectionId" | "updatedAt"
>

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
  findClaimed(id: string, reviewerId: string): Promise<PipelineResult | null>
  renewClaim(
    id: string,
    reviewerId: string,
    leaseDurationMs?: number
  ): Promise<PipelineResult | null>
  releaseClaim(id: string, reviewerId: string): Promise<boolean>
  decide(
    id: string,
    reviewerId: string,
    decision: PipelineReviewDecision,
    annotationId?: string | null
  ): Promise<PipelineResult | null>
  approveDetection(
    id: string,
    reviewerId: string,
    annotation: DetectionApproval
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
        ? cursor.score === null
          ? and(
              isNull(pipelineResultsTable.reviewScore),
              or(
                gt(pipelineResultsTable.reviewReadyAt, cursor.readyAt),
                and(
                  eq(pipelineResultsTable.reviewReadyAt, cursor.readyAt),
                  gt(pipelineResultsTable.id, cursor.id)
                )
              )
            )
          : or(
              lt(pipelineResultsTable.reviewScore, cursor.score),
              isNull(pipelineResultsTable.reviewScore),
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
            isNull(pipelineResultsTable.supersededBy),
            isNotNull(pipelineResultsTable.reviewReadyAt),
            cursorCondition
          )
        )
        .orderBy(
          sql`${pipelineResultsTable.reviewScore} desc nulls last`,
          asc(pipelineResultsTable.reviewReadyAt),
          asc(pipelineResultsTable.id)
        )
        .limit(Math.max(1, Math.min(limit, 100)))
      const last = items.at(-1)

      return {
        items,
        ...(last?.reviewReadyAt
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

    async findClaimed(id, reviewerId) {
      const [claimed] = await db
        .select()
        .from(pipelineResultsTable)
        .where(
          and(
            eq(pipelineResultsTable.id, id),
            eq(pipelineResultsTable.reviewStatus, "claimed"),
            eq(pipelineResultsTable.claimedBy, reviewerId),
            gt(pipelineResultsTable.claimExpiresAt, new Date())
          )
        )
        .limit(1)
      return claimed ?? null
    },

    async renewClaim(id, reviewerId, leaseDurationMs = 5 * 60 * 1000) {
      const now = new Date()
      const [renewed] = await db
        .update(pipelineResultsTable)
        .set({
          claimExpiresAt: new Date(now.getTime() + leaseDurationMs),
          updatedAt: now,
        })
        .where(
          and(
            eq(pipelineResultsTable.id, id),
            eq(pipelineResultsTable.reviewStatus, "claimed"),
            eq(pipelineResultsTable.claimedBy, reviewerId),
            gt(pipelineResultsTable.claimExpiresAt, now)
          )
        )
        .returning()
      return renewed ?? null
    },

    async releaseClaim(id, reviewerId) {
      const released = await db
        .update(pipelineResultsTable)
        .set({
          reviewStatus: "ready",
          claimedBy: null,
          claimExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(pipelineResultsTable.id, id),
            eq(pipelineResultsTable.reviewStatus, "claimed"),
            eq(pipelineResultsTable.claimedBy, reviewerId)
          )
        )
        .returning({ id: pipelineResultsTable.id })
      return released.length > 0
    },

    async decide(id, reviewerId, decision, annotationId) {
      const now = new Date()
      return db.transaction(async (tx) => {
        const [decided] = await tx
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

        if (decided?.kind === "media" && decided.mediaId) {
          await tx
            .update(mediaTable)
            .set({
              state: decision === "rejected" ? "rejected" : "reviewed",
            })
            .where(eq(mediaTable.id, decided.mediaId))
        }

        return decided ?? null
      })
    },

    async approveDetection(id, reviewerId, annotation) {
      const now = new Date()
      return db.transaction(async (tx) => {
        const [claimed] = await tx
          .select()
          .from(pipelineResultsTable)
          .where(
            and(
              eq(pipelineResultsTable.id, id),
              eq(pipelineResultsTable.kind, "detection"),
              eq(pipelineResultsTable.reviewStatus, "claimed"),
              eq(pipelineResultsTable.claimedBy, reviewerId),
              or(
                gt(pipelineResultsTable.claimExpiresAt, now),
                eq(pipelineResultsTable.claimExpiresAt, now)
              )
            )
          )
          .for("update")

        if (!claimed || claimed.mediaId !== annotation.mediaId) return null

        const [counter] = await tx
          .insert(annotationsIncrementerTable)
          .values({ mediaId: annotation.mediaId, lastId: 1 })
          .onConflictDoUpdate({
            target: annotationsIncrementerTable.mediaId,
            set: {
              lastId: sql`${annotationsIncrementerTable.lastId} + 1`,
            },
          })
          .returning({ detectionId: annotationsIncrementerTable.lastId })
        if (!counter) throw new Error("Failed to allocate detection ID")

        await tx.insert(detectionsTable).values({
          mediaId: annotation.mediaId,
          detectionId: counter.detectionId,
          source: annotation.source,
          category: annotation.category,
          type: annotation.type,
          score: annotation.score,
          data: annotation.data,
          createdAt: now,
          createdBy: reviewerId,
        })
        await tx.insert(annotationsTable).values({
          id,
          mediaId: annotation.mediaId,
          detectionId: counter.detectionId,
          individualId: annotation.individualId,
          updatedAt: now,
        })

        const [decided] = await tx
          .update(pipelineResultsTable)
          .set({
            reviewStatus: "approved",
            reviewedBy: reviewerId,
            reviewedAt: now,
            annotationId: id,
            claimExpiresAt: null,
            updatedAt: now,
          })
          .where(eq(pipelineResultsTable.id, id))
          .returning()

        if (annotation.individualId) {
          await createIndividualSummaryRepository().refresh(
            [annotation.individualId],
            tx
          )
        }
        return decided ?? null
      })
    },
  }
}
