import { randomUUID } from "crypto"
import { index, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core"

export const mediaTable = pgTable(
  "media",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .notNull()
      .$defaultFn(randomUUID),
    src: varchar("src", { length: 255 }).notNull(),
  }
)

export const mediaMetaTable = pgTable(
  "media_meta",
  {
    mediaId: varchar("media_id", { length: 36 })
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    key: varchar("key", { length: 75 }).notNull(),
    value: varchar("value", { length: 255 }).notNull(),
  },
  (table) => [
    index("media_idx").on(table.mediaId),
    primaryKey({ columns: [table.mediaId, table.key] }),
  ]
)
