import { index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core"

import { mediaTable } from "../media/sql"

export const exifTable = pgTable(
  "exif",
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
