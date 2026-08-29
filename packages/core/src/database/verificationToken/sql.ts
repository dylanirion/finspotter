import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const verificationTokensTable = pgTable("verification", {
  id: uuid("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
})
