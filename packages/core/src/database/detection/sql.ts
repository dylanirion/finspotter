import {
  AnnotationTypes,
  type AnnotationDataTypes,
  type AnnotationType,
} from "@finspotter/annotations"
import {
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import { Resource } from "sst"

import { usersTable } from "../auth/user/sql"
import { mediaTable } from "../media/sql"

type DetectionFunctions =
  keyof typeof Resource.MediaProcessingPipeline.detectionFunctions

export const detectionsTable = pgTable(
  "detections",
  {
    mediaId: varchar("media_id", { length: 36 })
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    detectionId: integer("detection_id").notNull(),
    source: pgEnum("source", [
      "manual",
      ...Object.keys(Resource.MediaProcessingPipeline.detectionFunctions),
    ]).$type<"manual" | DetectionFunctions>(),
    category: varchar("category", { length: 255 }),
    type: pgEnum("type", AnnotationTypes).$type<AnnotationType>(),
    score: real("score"),
    data: json("data").$type<AnnotationDataTypes[AnnotationType]>(),
    createdAt: timestamp("created_at").defaultNow(),
    createdBy: varchar("created_by", { length: 255 }).references(
      () => usersTable.id,
      {
        onDelete: "restrict",
        onUpdate: "cascade",
      }
    ),
    //TODO: reviewers table
  },
  (table) => [
    primaryKey({
      columns: [table.mediaId, table.detectionId, table.createdAt],
    }),
    index("media_idx").on(table.mediaId),
  ]
)
