import {
  index,
  inet,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { organizationsTable } from "../organization/sql"
import { usersTable } from "../user/sql"

export const sessionsTable = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    activeOrganizationId: uuid("active_organization_id").references(
      () => organizationsTable.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      }
    ),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    impersonatedBy: uuid("impersonated_by").references(() => usersTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index().on(table.userId),
    index().on(table.activeOrganizationId),
    index().on(table.token),
  ]
)
