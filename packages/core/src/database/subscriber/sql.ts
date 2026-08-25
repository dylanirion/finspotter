import { isNotNull } from "drizzle-orm"
import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "../auth/user/sql"
import { mediaTable } from "../media/sql"

export const subscribersTable = pgTable(
  "subscribers",
  {
    mediaId: uuid()
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid()
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    index().on(table.mediaId),
    index().on(table.userId),
    primaryKey({ columns: [table.mediaId, table.userId] }),
  ]
)
