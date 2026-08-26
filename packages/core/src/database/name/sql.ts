import { index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { organizationsTable } from "../auth/organization/sql"
import { individualsTable } from "../individual/sql"

export const nameTypeEnum = pgEnum("type", [
  "canonical",
  "nickname",
  "adoption",
])

// where to put name prefixes? separate prefix from number? then we can suggest next name per species
// should this be a more generic key value store
//TODO; allow adoption badge colour preferences
export const namesTable = pgTable(
  "names",
  {
    individualId: uuid("individual_id")
      .references(() => individualsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizationsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    type: nameTypeEnum().notNull(),
    value: text("value").notNull(),
  },
  (table) => [index().on(table.individualId), index().on(table.organizationId)]
)

/*
//TODO: organization, species/prefix
export const namesIncrementer = mysqlTable("annotation_incrementer", {
  organizationId: varchar("organization_id", { length: 36 })
    .references(() => organizationsTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  prefix: varchar("prefix", { length: 36 })
    .references(() => prefixTable.prefix, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .primaryKey()
    .notNull(),
  maxId: int("max_id").notNull().default(0),
})
*/
