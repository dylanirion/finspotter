import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { mediaTable } from "../media/sql"
import { pipelineResultsTable } from "../pipelineResult/sql"
import { usersTable } from "../user/sql"

export const comparisonDecisionSourceEnum = pgEnum(
  "comparison_decision_source",
  ["pair", "indexed_match", "manual"]
)

export const comparisonVerdictEnum = pgEnum("comparison_verdict", [
  "same",
  "different",
  "inconclusive",
])

export const comparisonDecisionsTable = pgTable(
  "comparison_decisions",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // Nullable so the evidence edge outlives the operational review row that
    // produced it, and so manually created comparisons can be recorded.
    resultId: uuid("result_id").references(() => pipelineResultsTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    source: comparisonDecisionSourceEnum("source").notNull(),
    // The two observations are stored in a canonical order so the same
    // unordered pair proposed by pairwise and indexed search collapses onto a
    // single edge. Use canonicalizeComparisonPair before writing.
    aMediaId: uuid("a_media_id")
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    aDetectionId: integer("a_detection_id").notNull(),
    bMediaId: uuid("b_media_id")
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    bDetectionId: integer("b_detection_id").notNull(),
    verdict: comparisonVerdictEnum("verdict").notNull(),
    score: doublePrecision("score"),
    decidedBy: uuid("decided_by").references(() => usersTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("comparison_decisions_pair_idx").on(
      table.aMediaId,
      table.aDetectionId,
      table.bMediaId,
      table.bDetectionId
    ),
    index("comparison_decisions_result_idx").on(table.resultId),
    index("comparison_decisions_a_idx").on(table.aMediaId, table.aDetectionId),
    index("comparison_decisions_b_idx").on(table.bMediaId, table.bDetectionId),
  ]
)
