import "server-only"

import { and, desc, eq, sql } from "drizzle-orm"

import { db as defaultDb, type DatabaseClient } from "../_drizzle"
import { annotationsTable } from "../annotation/sql"
import { mediaTable } from "../media/sql"
import { namesTable } from "../name/sql"
import { submissionsTable } from "./sql"

export function createSubmissionRepository(db: DatabaseClient = defaultDb) {
  return {
    async findRecentByUser(userId: string, limit = 10) {
      const recent = db
        .select({
          mediaId: submissionsTable.mediaId,
          submittedAt: submissionsTable.submittedAt,
          state: mediaTable.state,
        })
        .from(submissionsTable)
        .innerJoin(mediaTable, eq(mediaTable.id, submissionsTable.mediaId))
        .where(eq(submissionsTable.userId, userId))
        .orderBy(
          sql`${submissionsTable.submittedAt} desc nulls last`,
          desc(submissionsTable.mediaId)
        )
        .limit(limit)
        .as("recent_submissions")

      return db
        .select({
          mediaId: recent.mediaId,
          submittedAt: recent.submittedAt,
          state: recent.state,
          annotationId: annotationsTable.id,
          individualId: annotationsTable.individualId,
          name: sql<string | null>`(
            select min(${namesTable.value}) from ${namesTable}
            where ${namesTable.individualId} = ${annotationsTable.individualId}
              and ${namesTable.type} = 'canonical'
          )`,
        })
        .from(recent)
        .leftJoin(
          annotationsTable,
          and(
            eq(annotationsTable.mediaId, recent.mediaId),
            eq(recent.state, "reviewed")
          )
        )
        .orderBy(
          sql`${recent.submittedAt} desc nulls last`,
          desc(recent.mediaId),
          annotationsTable.detectionId,
          annotationsTable.id
        )
    },
  }
}
