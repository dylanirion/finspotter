import { randomUUID } from "crypto"
import { sql } from "drizzle-orm"
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const organizationsTable = pgTable(
  "organization",
  {
    id: varchar("id", { length: 255 }).primaryKey().$defaultFn(randomUUID),
    name: varchar("name", { length: 255 }).notNull(),
    shortName: varchar("short_name", { length: 255 }),
    slug: varchar("slug", { length: 255 }).notNull(),
    logo: varchar("logo", { length: 255 }),
    metadata: varchar("metadata", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index("slug_idx").on(table.slug)]
)

export const membersTable = mysqlTable(
  "member",
  {
    id: varchar("id", { length: 255 }).primaryKey().$defaultFn(randomUUID),
    userId: varchar("user_id", { length: 255 })
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    organizationId: varchar("organization_id", { length: 255 })
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
  (table) => [
    index("user_idx").on(table.userId),
    index("org_idx").on(table.organizationId),
  ]
)

export const invitationsTable = pgTable(
  "invitation",
  {
    id: varchar("id", { length: 255 }).primaryKey().$defaultFn(randomUUID),
    email: varchar("email", { length: 255 })
      .references(() => usersTable.email, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    inviterId: varchar("inviter_id", { length: 255 })
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    organizationId: varchar("organization_id", { length: 255 })
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
    index("email_idx").on(table.email),
    index("inviter_idx").on(table.inviterId),
    index("org_idx").on(table.organizationId),
  ]
)
