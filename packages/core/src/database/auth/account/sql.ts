import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const accountsTable = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    issuer: text("issuer").notNull(),
    accountId: uuid("account_id").notNull(),
    providerId: uuid("provider_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    accessToken: text("access_token"),
    accessTokenexpiresAt: timestamp("access_token_expires_at"),
    refreshToken: text("refresh_token"),
    refreshTokenexpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    idToken: text("id_token"),
  },
  (table) => [index().on(table.userId)]
)
