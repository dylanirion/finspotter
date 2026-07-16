import { pgTable, text, varchar } from "drizzle-orm/pg-core"

export const individualsTable = pgTable("individuals", {
  id: varchar("id", { length: 36 }).primaryKey().notNull(),
  comments: text("comments"),
})
