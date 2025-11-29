import {
  AnnotationTypes,
  type AnnotationDataTypes,
  type AnnotationType,
} from "@finspotter/annotations"
import {
  float,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core"
import { Resource } from "sst"

import { usersTable } from "../auth/user/sql"
import { mediaTable } from "../media/sql"

type DetectionFunctions =
  keyof typeof Resource.ImageProcessingPipeline.detectionFunctions

export const detectionsTable = mysqlTable(
  "detections",
  {
    mediaId: varchar("media_id", { length: 36 })
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    detectionId: int("detection_id").notNull(),
    source: mysqlEnum("source", [
      "manual",
      ...Object.keys(Resource.ImageProcessingPipeline.detectionFunctions),
    ]).$type<"manual" | DetectionFunctions>(),
    category: varchar("category", { length: 255 }),
    type: mysqlEnum("type", AnnotationTypes).$type<AnnotationType>(),
    score: float("score"),
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
