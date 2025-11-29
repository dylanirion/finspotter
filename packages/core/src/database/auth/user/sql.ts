import { randomUUID } from "crypto"
import { sql } from "drizzle-orm"
import {
  boolean,
  datetime,
  index,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core"

//TODO: notificationPreferences, defaults (weekly digest, daily, sighting emails, for all associated encounters, or only , etc.)
export const usersTable = mysqlTable(
  "user",
  {
    id: varchar("id", { length: 255 }).primaryKey().$defaultFn(randomUUID),
    name: varchar("name", { length: 255 }),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: boolean("email_verified").default(false),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: datetime("updated_at", { mode: "date" }).default(
      sql`now() ON UPDATE now()`
    ),
    image: varchar("image", { length: 255 }),
    role: varchar("role", { length: 255 }).default("user"),
    banned: boolean("banned").default(false),
    bannedReason: varchar("banned_reason", { length: 255 }),
    banExpires: datetime("ban_expires", { mode: "date" }),
  },
  (table) => [index("email_idx").on(table.email)]
)
