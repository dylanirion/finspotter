import {
  boolean,
  index,
  inet,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { mediaTable } from "../media/sql"
import { organizationsTable } from "../organization/sql"
import { usersTable } from "../user/sql"

export const submissionsTable = pgTable(
  "submissions",
  {
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .primaryKey()
      .notNull(),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "restrict", // Cannot delete user if they have submissions
      onUpdate: "cascade",
    }),
    organizationId: uuid("organization_id").references(
      () => organizationsTable.id,
      { onDelete: "restrict", onUpdate: "cascade" } // Cannot delete organization if they have submissions
    ),
    submittedAt: timestamp("submitted_at").defaultNow(),
    submissionId: text("submission_id"),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    updatesEnabled: boolean("updates_enabled").notNull().default(true),
    submittedFrom: inet("submitted_from"),
  },
  (table) => [
    index().on(table.mediaId),
    index().on(table.userId),
    index().on(table.submissionId),
    index().on(table.organizationId),
  ]
)
