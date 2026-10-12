import { Pool } from "@neondatabase/serverless"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is required to configure pgvector")
}

const tables = JSON.parse(process.env.VECTOR_TABLES ?? "{}")
const pool = new Pool({ connectionString })

try {
  await executeWithRetry(() =>
    pool.query("create extension if not exists vector")
  )

  for (const [name, dimensions] of Object.entries(tables)) {
    const table = safeIdentifier(name)
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error(`Invalid vector dimensions for ${table}: ${dimensions}`)
    }

    await executeWithRetry(() =>
      pool.query(
        `create table if not exists ${table} (id bigserial primary key, annotation_id varchar(255) not null, feature_id integer not null, category varchar(255), embedding vector(${dimensions}), unique (annotation_id, feature_id))`
      )
    )
    await Promise.all([
      executeWithRetry(() =>
        pool.query(
          `create index if not exists idx_${table}_hnsw on ${table} using hnsw (embedding vector_l2_ops)`
        )
      ),
      executeWithRetry(() =>
        pool.query(
          `create index if not exists idx_${table}_category on ${table} (category)`
        )
      ),
    ])
  }
} finally {
  await pool.end()
}

function safeIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid pgvector table name: ${identifier}`)
  }

  return identifier
}

async function executeWithRetry(execute, retries = 10, delay = 1_000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await execute()
    } catch (error) {
      if (attempt === retries - 1) throw error
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, attempt))
      )
    }
  }
}
