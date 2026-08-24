import { index, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core"

export const mediaTable = pgTable("media", {
  id: uuid().primaryKey().notNull().defaultRandom(),
  src: varchar("src", { length: 255 }).notNull(),
})

export const mediaMetaTable = pgTable(
  "media_meta",
  {
    mediaId: uuid()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    key: varchar("key", { length: 75 }).notNull(),
    value: varchar("value", { length: 255 }).notNull(),
  },
  (table) => [
    index().on(table.mediaId),
    primaryKey({ columns: [table.mediaId, table.key] }),
  ]
)
