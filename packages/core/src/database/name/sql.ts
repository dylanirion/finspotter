import { index, pgEnum, pgTable, text, varchar } from "drizzle-orm/pg-core"

import { organizationsTable } from "../auth/organization/sql"
import { individualsTable } from "../individual/sql"

// where to put name prefixes? separate prefix from number? then we can suggest next name per species
// should this be a more generic key value store
//TODO; allow adoption badge colour preferences
export const namesTable = pgTable(
  "names",
  {
    individualId: varchar("individual_id", { length: 36 })
      .references(() => individualsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    organizationId: varchar("organization_id", { length: 36 })
      .references(() => organizationsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    type: pgEnum("type", ["canonical", "nickname", "adoption"]).notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    index("individual_idx").on(table.individualId),
    index("organization_idx").on(table.organizationId),
  ]
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
