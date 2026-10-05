import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const accountsTable = pgTable(
  "account",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    accountId: uuid("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { precision: 6, withTimezone: true }),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { precision: 6, withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    idToken: text("id_token"),
  },
  (table) => [index().on(table.userId)]
)
