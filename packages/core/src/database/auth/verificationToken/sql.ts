import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

export const verificationTokensTable = pgTable("verification", {
  id: uuid().primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
})
