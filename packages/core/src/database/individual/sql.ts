import { pgTable, text, uuid } from "drizzle-orm/pg-core"

export const individualsTable = pgTable("individuals", {
  id: uuid().primaryKey().notNull(),
  comments: text("comments"),
})
