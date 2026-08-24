import { index, pgTable, text, timestamp, varchar, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "../user/sql"

export const accountsTable = pgTable(
  "account",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    accountId: uuid().notNull(),
    providerId: uuid().notNull(),
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
