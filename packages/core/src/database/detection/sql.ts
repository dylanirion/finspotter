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
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { Resource } from "sst"

import { usersTable } from "../auth/user/sql"
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
    mediaId: uuid()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    detectionId: integer("detection_id").notNull(),
    source: detectionSourceEnum(),
    category: varchar("category", { length: 255 }),
    type: annotationTypeEnum(),
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
    index().on(table.mediaId),
  ]
)
