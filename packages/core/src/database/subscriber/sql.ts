import { index, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core"

import { usersTable } from "../auth/user/sql"
import { mediaTable } from "../media/sql"

export const subscribersTable = pgTable(
  "subscribers",
  {
    mediaId: varchar("media_id", { length: 36 })
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: varchar("user_id", { length: 255 }).references(
      () => usersTable.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      }
    ),
  },
  (table) => [
    index("individual_idx").on(table.mediaId),
    index("user_idx").on(table.userId),
    primaryKey({ columns: [table.mediaId, table.userId] }),
  ]
)
