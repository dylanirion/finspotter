import { date, index, pgTable, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "../auth/user/sql"
import { individualsTable } from "../individual/sql"

//TODO: organization (non-user) adoptions?
export const adoptionsTable = pgTable(
  "adoptions",
  {
    id: uuid("id").primaryKey().notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    orderId: uuid("order_id"),
    userId: uuid("user_id")
      .references(() => usersTable.id, {
        onDelete: "restrict", // Cannot delete user if they have an adoption
        onUpdate: "cascade",
      })
      .notNull(),
    individualId: uuid("individual_id")
      .references(
        () => individualsTable.id,
        { onDelete: "restrict", onUpdate: "cascade" } // Cannot delete an individual if someone has adopted it
      )
      .notNull(),
  },
  (table) => [index().on(table.userId), index().on(table.individualId)]
)
