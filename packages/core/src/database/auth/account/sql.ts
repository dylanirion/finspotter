import { randomUUID } from "crypto"
import {
  datetime,
  index,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core"

import { usersTable } from "../user/sql"

export const accountsTable = mysqlTable(
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
    createdAt: datetime("created_at", { mode: "date" }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
    accessToken: text("access_token"),
    accessTokenexpiresAt: datetime("access_token_expires_at", { mode: "date" }),
    refreshToken: text("refresh_token"),
    refreshTokenexpiresAt: datetime("refresh_token_expires_at", {
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    idToken: text("id_token"),
  },
  (table) => [index("user_idx").on(table.userId)]
)
