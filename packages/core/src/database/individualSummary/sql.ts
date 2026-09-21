import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { individualsTable } from "../individual/sql"

export const individualSummariesTable = pgTable(
  "individual_summaries",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => individualsTable.id, { onDelete: "cascade" })
      .notNull(),
    canonicalNames: text("canonical_names")
      .array()
      .notNull()
      .default(sql`array[]::text[]`),
    nickNames: text("nick_names")
      .array()
      .notNull()
      .default(sql`array[]::text[]`),
    species: text("species"),
    totalEncounters: integer("total_encounters").notNull().default(0),
    lastSeen: timestamp("last_seen"),
    // lastSeenLocation: text("last_seen_location"),
    src: text("src"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index().on(table.species),
    index().on(table.lastSeen),
    index().on(table.totalEncounters),
  ]
)
