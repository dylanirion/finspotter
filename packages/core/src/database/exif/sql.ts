import { index, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core"

import { mediaTable } from "../media/sql"

export const exifTable = pgTable(
  "exif",
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
