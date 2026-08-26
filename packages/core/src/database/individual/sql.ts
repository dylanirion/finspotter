import { pgTable, text, uuid } from "drizzle-orm/pg-core"

//TODO: individual Summary Table

export const individualsTable = pgTable("individuals", {
  id: uuid("id").primaryKey().notNull(),
  comments: text("comments"),
})
