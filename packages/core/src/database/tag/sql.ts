import { index, pgTable, varchar } from "drizzle-orm/pg-core"

import { individualsTable } from "../individual/sql"

//TODO generic tag types
export const tagsTable = pgTable(
  "tags",
  {
    id: varchar("id", { length: 255 }).primaryKey().notNull(), //drop this
    number: varchar("number", { length: 255 }), // decide between this and serial number and make composite primary key with individual
    serialNumber: varchar("serial_number", { length: 255 }),
    individualId: varchar("individual_id", { length: 36 }).references(
      () => individualsTable.id,
      { onDelete: "cascade", onUpdate: "cascade" }
    ),
  },
  (table) => [index("individual_idx").on(table.individualId)]
)
