import { index, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core"

import { mediaTable } from "../media/sql"

export const exifTable = pgTable(
  "exif",
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
