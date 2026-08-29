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
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { Resource } from "sst"

import { usersTable } from "../user/sql"
import { mediaTable } from "../media/sql"

export const detectionSourceEnum = pgEnum("source", [
  "manual",
  ...Object.keys(
    "MediaProcessingPipeline" in Resource
      ? (Resource as any).MediaProcessingPipeline.detectionFunctions
      : {}
  ),
])
export const annotationTypeEnum = pgEnum("type", AnnotationTypes)

export const detectionsTable = pgTable(
  "detections",
  {
    mediaId: uuid("media_id")
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    detectionId: integer("detection_id").notNull(),
    source: detectionSourceEnum(),
    category: text("category"),
    type: annotationTypeEnum(),
    score: real("score"),
    data: json("data").$type<AnnotationDataTypes[AnnotationType]>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    //TODO: reviewers table
  },
  (table) => [
    primaryKey({
      columns: [table.mediaId, table.detectionId, table.createdAt],
    }),
    index().on(table.mediaId),
  ]
)
