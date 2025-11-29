import { datetime, mysqlTable, varchar } from "drizzle-orm/mysql-core"

export const verificationTokensTable = mysqlTable("verification", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date" }).notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
})
