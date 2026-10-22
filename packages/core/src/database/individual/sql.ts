import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const individualsTable = pgTable("individuals", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  comments: text("comments"),
})

export const individualRedirectsTable = pgTable(
  "individual_redirects",
  {
    sourceId: uuid("source_id").primaryKey().notNull(),
    targetId: uuid("target_id")
      .references(() => individualsTable.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      })
      .notNull(),
    mergedBy: uuid("merged_by").references(() => usersTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    mergedAt: timestamp("merged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index().on(table.targetId)]
)
