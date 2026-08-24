import {
  customType,
  index,
  inet,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { organizationsTable } from "../auth/organization/sql"
import { usersTable } from "../auth/user/sql"
import { mediaTable } from "../media/sql"

export const submissionsTable = pgTable(
  "submissions",
  {
    mediaId: uuid()
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .primaryKey()
      .notNull(),
    userId: uuid().references(() => usersTable.id, {
      onDelete: "restrict", // Cannot delete user if they have submissions
      onUpdate: "cascade",
    }),
    organizationId: uuid().references(
      () => organizationsTable.id,
      { onDelete: "restrict", onUpdate: "cascade" } // Cannot delete organization if they have submissions
    ),
    submittedAt: timestamp("submitted_at").defaultNow(),
    submittedFrom: inet("submitted_from"),
  },
  (table) => [
    index().on(table.mediaId),
    index().on(table.userId),
    index().on(table.organizationId),
  ]
)
