import { and, eq } from "drizzle-orm"

import { db } from "../_drizzle"
import { annotationsTable } from "../annotation/sql"
import { detectionsTable } from "./sql"

type DetectionColumns = keyof typeof detectionsTable.$inferSelect

const selectFromDetections = () => {
  return db.select().from(detectionsTable).$dynamic()
}

export const detectionsSubQuery = () =>
  selectFromDetections()
    .where(
      and(
        eq(annotationsTable.mediaId, detectionsTable.mediaId),
        eq(annotationsTable.detectionId, detectionsTable.detectionId),
        eq(annotationsTable.updatedAt, detectionsTable.createdAt)
      )
    )
    .as("detections")
