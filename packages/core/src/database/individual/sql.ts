import { mediumtext, mysqlTable, varchar } from "drizzle-orm/mysql-core"

export const individualsTable = mysqlTable("individuals", {
  id: varchar("id", { length: 36 }).primaryKey().notNull(),
  comments: mediumtext("comments"),
})
