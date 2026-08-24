import { index, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core"

import { individualsTable } from "../individual/sql"

export const tagsTable = pgTable(
  "tags",
  {
    serialNumber: varchar("serial_number", { length: 255 }),
    individualId: uuid().references(() => individualsTable.id, {
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
