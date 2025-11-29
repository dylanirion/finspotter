import {
  index,
  mysqlTable,
  primaryKey,
  timestamp,
  varbinary,
  varchar,
} from "drizzle-orm/mysql-core"

import { organizationsTable } from "../auth/organization/sql"
import { usersTable } from "../auth/user/sql"
import { mediaTable } from "../media/sql"

export const submissionsTable = mysqlTable(
  "submissions",
  {
    mediaId: varchar("media_id", { length: 36 })
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .primaryKey()
      .notNull(),
    userId: varchar("user_id", { length: 255 }).references(
      () => usersTable.id,
      {
        onDelete: "restrict", // Cannot delete user if they have submissions
        onUpdate: "cascade",
      }
    ),
    organizationId: varchar("organization_id", { length: 36 }).references(
      () => organizationsTable.id,
      { onDelete: "restrict", onUpdate: "cascade" } // Cannot delete organization if they have submissions
    ),
    submittedAt: timestamp("submitted_at").defaultNow(),
    submittedFrom: varbinary("submitted_from", { length: 16 }), // IP address
  },
  (table) => [
    index("media_idx").on(table.mediaId),
    index("user_idx").on(table.userId),
    index("organization_idx").on(table.organizationId),
  ]
)
