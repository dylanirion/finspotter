import { randomUUID } from "crypto"
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core"

import { organizationsTable } from "../organization/sql"
import { usersTable } from "../user/sql"

export const sessionsTable = pgTable(
  "session",
  {
    id: varchar("id", { length: 255 }).primaryKey().$defaultFn(randomUUID),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    activeOrganizationId: varchar("active_organization_id", {
      length: 255,
    }).references(() => organizationsTable.id, {
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
    index("user_idx").on(table.userId),
    index("active_org_idx").on(table.activeOrganizationId),
    index("token_idx").on(table.token),
  ]
)
