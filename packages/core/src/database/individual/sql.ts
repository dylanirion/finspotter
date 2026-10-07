import { pgTable, text, uuid } from "drizzle-orm/pg-core"

export const individualsTable = pgTable("individuals", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  comments: text("comments"),
})
