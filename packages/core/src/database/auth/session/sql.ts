import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

import { organizationsTable } from "../organization/sql"
import { usersTable } from "../user/sql"

export const sessionsTable = pgTable(
  "session",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    activeOrganizationId: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    ipAddress: varchar("ip_address", { length: 255 }),
    userAgent: varchar("user_agent", { length: 255 }),
    token: varchar("token", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    impersonatedBy: varchar("impersonated_by", { length: 255 }).references(
      () => usersTable.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      }
    ),
  },
  (table) => [
    index().on(table.userId),
    index().on(table.activeOrganizationId),
    index().on(table.token),
  ]
)
