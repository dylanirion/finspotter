import { createStorageRepository } from "@finspotter/core/storage"
import { Pool } from "@neondatabase/serverless"

import { createIndexedSearchHandler } from "./search"

let pool: Pool | undefined

export const handler = createIndexedSearchHandler({
  storage: createStorageRepository(),
  query: async (sql, parameters) => {
    if (!pool) {
      const connectionString = process.env.DATABASE_URL
      if (!connectionString) throw new Error("DATABASE_URL is required")
      pool = new Pool({ connectionString })
    }
    return (await pool.query(sql, parameters)).rows
  },
})
