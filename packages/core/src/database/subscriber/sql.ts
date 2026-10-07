import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { mediaTable } from "../media/sql"
import { usersTable } from "../user/sql"

export const subscribersTable = pgTable(
  "subscribers",
  {
    submissionId: text("submission_id"),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    updatesEnabled: boolean("updates_enabled").notNull().default(true),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    index().on(table.mediaId),
    index().on(table.userId),
    index().on(table.submissionId),
    primaryKey({ columns: [table.mediaId, table.userId] }),
  ]
)
