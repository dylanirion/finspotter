import { randomUUID } from "crypto"
import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const accountsTable = pgTable(
  "account",
  {
    id: varchar("id", { length: 255 }).primaryKey().$defaultFn(randomUUID),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    accountId: varchar("account_id", {
      length: 36,
    }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
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
  (table) => [index("user_idx").on(table.userId)]
)
