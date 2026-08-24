import { sql } from "drizzle-orm"
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const organizationsTable = pgTable(
  "organization",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    shortName: varchar("short_name", { length: 255 }),
    slug: varchar("slug", { length: 255 }).notNull(),
    logo: varchar("logo", { length: 255 }),
    metadata: varchar("metadata", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index().on(table.slug)]
)

export const membersTable = pgTable(
  "member",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    organizationId: uuid()
      .references(() => organizationsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    role: varchar("role", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index().on(table.userId), index().on(table.organizationId)]
)

export const invitationsTable = pgTable(
  "invitation",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 })
      .references(() => usersTable.email, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    inviterId: uuid()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    organizationId: uuid()
      .references(() => organizationsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    role: varchar("role", { length: 255 }).notNull(),
    status: varchar("status", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index().on(table.email),
    index().on(table.inviterId),
    index().on(table.organizationId),
  ]
)
