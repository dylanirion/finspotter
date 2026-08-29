import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const organizationsTable = pgTable(
  "organization",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    slug: varchar("slug", { length: 255 }).notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index().on(table.slug)]
)

export const membersTable = pgTable(
  "member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => usersTable.id, {
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
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index().on(table.userId), index().on(table.organizationId)]
)

export const invitationsTable = pgTable(
  "invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 })
      .references(() => usersTable.email, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    inviterId: uuid("user_id")
      .references(() => usersTable.id, {
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
    role: text("role").notNull(),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.email),
    index().on(table.inviterId),
    index().on(table.organizationId),
  ]
)
