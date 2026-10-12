import { Pool } from "@neondatabase/serverless"
import { z } from "zod"

const eventSchema = z.object({
  id: z.string().min(1),
})
const tablesSchema = z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/))

declare const globalThis: {
  pgVectorPool: Pool | undefined
} & typeof global

function getPool() {
  if (!globalThis.pgVectorPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error("DATABASE_URL is required")
    globalThis.pgVectorPool = new Pool({ connectionString })
  }

  return globalThis.pgVectorPool
}

export async function handler(input: unknown) {
  const { id } = eventSchema.parse(input)
  const tables = tablesSchema.parse(
    JSON.parse(process.env.ALLOWED_TABLES ?? "[]")
  )
  const pool = getPool()
  const client = await pool.connect()
  let removed = 0

  try {
    await client.query("begin")
    for (const table of tables) {
      const result = await client.query(
        `delete from ${table} where annotation_id = $1`,
        [id]
      )
      removed += result.rowCount ?? 0
    }
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }

  return { removed }
}
