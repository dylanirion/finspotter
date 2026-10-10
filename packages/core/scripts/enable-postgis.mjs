import { neon } from "@neondatabase/serverless"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required to enable PostGIS")
}

const sql = neon(connectionString)

await sql`CREATE EXTENSION IF NOT EXISTS postgis`

const [extension] = await sql`
  SELECT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'postgis'
  ) AS installed
`

if (!extension?.installed) {
  throw new Error("PostGIS extension was not installed")
}

console.log("PostGIS extension enabled")
