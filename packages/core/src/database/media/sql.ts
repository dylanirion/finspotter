import { randomUUID } from "crypto"
import { index, mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core"

export const mediaTable = mysqlTable(
  "media",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .notNull()
      .$defaultFn(randomUUID),
    contentHash: varchar("content_hash", { length: 30 }), //TODO: remove
    src: varchar("src", { length: 255 }).notNull(),
  },
  (table) => [index("content_hash_idx").on(table.contentHash)]
)

export const mediaMetaTable = mysqlTable(
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
