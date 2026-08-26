import { index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core"

import { individualsTable } from "../individual/sql"

export const tagsTable = pgTable(
  "tags",
  {
    serialNumber: text("serial_number").notNull(),
    individualId: uuid("individual_id")
      .notNull()
      .references(() => individualsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.serialNumber, table.individualId],
    }),
    index().on(table.individualId),
  ]
)
