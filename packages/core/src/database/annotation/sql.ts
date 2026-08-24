import { type ExtractionFunction } from "@finspotter/config/pipeline"
import {
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { detectionsTable } from "../detection/sql"
import { individualsTable } from "../individual/sql"
import { mediaTable } from "../media/sql"

export const annotationsTable = pgTable(
  "annotations",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    mediaId: uuid()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    detectionId: integer("detection_id").notNull(),
    //TODO: remove this? replace with individual?
    individualId: uuid().references(() => individualsTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    numFeatures:
      json("num_features").$type<Record<ExtractionFunction, string>>(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index().on(table.mediaId),
    index().on(table.individualId),
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

export const annotationMetaTable = pgTable(
  "annotation_meta",
  {
    annotationId: uuid()
      .references(() => annotationsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    key: varchar("key", { length: 75 }).notNull(),
    value: varchar("value", { length: 255 }).notNull(),
  },
  (table) => [
    index().on(table.annotationId),
    primaryKey({ columns: [table.annotationId, table.key] }),
  ]
)

export const annotationsIncrementerTable = pgTable("annotation_incrementer", {
  mediaId: uuid()
    .references(() => mediaTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .primaryKey()
    .notNull(),
  lastId: integer("last_id").notNull().default(0),
})
