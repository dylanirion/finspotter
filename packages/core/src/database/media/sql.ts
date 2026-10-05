import { index, pgEnum, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core"

export const mediaStateEnum = pgEnum("media_state", [
  "pending",
  "reviewed",
  "rejected",
])

export const mediaTable = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    src: text("src").notNull(),
    state: mediaStateEnum("state").notNull().default("reviewed"),
  },
  (table) => [index().on(table.state)]
)

export const mediaMetaTable = pgTable(
  "media_meta",
  {
    mediaId: uuid("media_id")
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    index().on(table.mediaId),
    primaryKey({ columns: [table.mediaId, table.key] }),
  ]
)
