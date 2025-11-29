import { randomUUID } from "crypto"
import { type ExtractionFunction } from "@finspotter/pipeline"
import {
  foreignKey,
  index,
  int,
  json,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core"

import { detectionsTable } from "../detection/sql"
import { individualsTable } from "../individual/sql"
import { mediaTable } from "../media/sql"

export const annotationsTable = mysqlTable(
  "annotations",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .notNull()
      .$defaultFn(randomUUID),
    mediaId: varchar("media_id", { length: 36 })
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    detectionId: int("detection_id").notNull(),
    //TODO: remove this? replace with individual?
    individualId: varchar("individual_id", { length: 36 }).references(
      () => individualsTable.id,
      { onDelete: "cascade", onUpdate: "cascade" }
    ),
    numFeatures:
      json("num_features").$type<Record<ExtractionFunction, string>>(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("media_idx").on(table.mediaId),
    index("individual_idx").on(table.individualId),
    foreignKey({
      columns: [table.mediaId, table.detectionId, table.updatedAt],
      foreignColumns: [
        detectionsTable.mediaId,
        detectionsTable.detectionId,
        detectionsTable.createdAt,
      ],
      name: "detections_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
)

export const annotationMetaTable = mysqlTable(
  "annotation_meta",
  {
    annotationId: varchar("annotation_id", { length: 36 })
      .references(() => annotationsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    key: varchar("key", { length: 75 }).notNull(),
    value: varchar("value", { length: 255 }).notNull(),
  },
  (table) => [
    index("media_idx").on(table.annotationId),
    primaryKey({ columns: [table.annotationId, table.key] }),
  ]
)

export const annotationsIncrementerTable = mysqlTable(
  "annotation_incrementer",
  {
    mediaId: varchar("media_id", { length: 36 })
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .primaryKey()
      .notNull(),
    lastId: int("last_id").notNull().default(0),
  }
)
