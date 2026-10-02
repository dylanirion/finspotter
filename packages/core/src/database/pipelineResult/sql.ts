import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { annotationsTable } from "../annotation/sql"
import { usersTable } from "../user/sql"

export const pipelineResultKindEnum = pgEnum("pipeline_result_kind", [
  "media",
  "detection",
  "extraction",
  "pair",
  "indexed_match",
])

export const pipelineReviewStatusEnum = pgEnum("pipeline_review_status", [
  "pending",
  "ready",
  "claimed",
  "approved",
  "rejected",
  "inferred",
])

export const pipelineResultRelationEnum = pgEnum("pipeline_result_relation", [
  "derived_from",
  "query",
  "reference",
  "supersedes",
])

export const pipelineResultsTable = pgTable(
  "pipeline_results",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    sourceSystem: text("source_system").notNull().default("dynamodb"),
    sourcePk: text("source_pk").notNull(),
    sourceSk: text("source_sk").notNull(),
    kind: pipelineResultKindEnum().notNull(),
    submissionId: text("submission_id").notNull(),
    mediaId: text("media_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    supersededBy: text("superseded_by"),
    final: boolean("final").notNull().default(false),
    reviewStatus: pipelineReviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    reviewScore: doublePrecision("review_score"),
    reviewReadyAt: timestamp("review_ready_at", { withTimezone: true }),
    claimedBy: uuid("claimed_by").references(() => usersTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => usersTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    annotationId: uuid("annotation_id").references(() => annotationsTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pipeline_results_source_idx").on(
      table.sourceSystem,
      table.sourcePk,
      table.sourceSk
    ),
    index("pipeline_results_review_queue_idx").on(
      table.reviewStatus,
      table.reviewScore.desc(),
      table.reviewReadyAt.asc(),
      table.id.asc()
    ),
    index("pipeline_results_submission_idx").on(table.submissionId),
    index("pipeline_results_media_idx").on(table.mediaId),
  ]
)

export const pipelineResultLinksTable = pgTable(
  "pipeline_result_links",
  {
    resultId: uuid("result_id")
      .notNull()
      .references(() => pipelineResultsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    relation: pipelineResultRelationEnum().notNull(),
    relatedSourceSystem: text("related_source_system")
      .notNull()
      .default("dynamodb"),
    relatedSourcePk: text("related_source_pk").notNull(),
    relatedSourceSk: text("related_source_sk").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.resultId,
        table.relation,
        table.relatedSourceSystem,
        table.relatedSourcePk,
        table.relatedSourceSk,
      ],
    }),
    index("pipeline_result_links_related_idx").on(
      table.relatedSourceSystem,
      table.relatedSourcePk,
      table.relatedSourceSk
    ),
  ]
)
