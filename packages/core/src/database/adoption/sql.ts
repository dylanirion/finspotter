import {
  date,
  index,
  mediumtext,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core"

import { individualsTable } from "../individual/sql"
import { usersTable } from "../auth/user/sql"

//TODO: organization (non-user) adoptions?
export const adoptionsTable = mysqlTable(
  "adoptions",
  {
    id: varchar("id", { length: 100 }).primaryKey().notNull(),
    image: mediumtext("image"), //TODO: create a user and get this from user image
    quote: mediumtext("quote"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    type: varchar("type", { length: 100 }),
    notes: mediumtext("notes"),
    orderId: varchar("order_id", { length: 100 }), //TODO rename may break woocommerce? not sure where that insert occurs (in woocommerce or finspotter?)
    userId: varchar("user_id", { length: 255 })
      .references(() => usersTable.id, {
        onDelete: "restrict", // Cannot delete user if they have an adoption
        onUpdate: "cascade",
      })
      .notNull(),
    individualId: varchar("individual_id", { length: 36 }).references(
      () => individualsTable.id,
      { onDelete: "restrict", onUpdate: "cascade" } // Cannot delete an individual if someone has adopted it
    ),
  },
  (table) => [
    index("user_idx").on(table.userId),
    index("individual_idx").on(table.individualId),
  ]
)
