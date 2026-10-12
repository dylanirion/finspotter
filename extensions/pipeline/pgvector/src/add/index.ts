import { createStorageRepository } from "@finspotter/core/storage"
import { Pool } from "@neondatabase/serverless"
import { z } from "zod"

const TWO_MEGABYTES = 2 * 1024 * 1024

type Event = {
  id: string
  type: string
  category: string
  bucket: string
  key: string
}

const storage = createStorageRepository()
const featuresSchema = z.array(z.array(z.number()))

declare const globalThis: {
  pgVectorPool: Pool | undefined
} & typeof global

function getPool() {
  if (!globalThis.pgVectorPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error("DATABASE_URL is required")
    globalThis.pgVectorPool = new Pool({
      connectionString,
    })
  }

  return globalThis.pgVectorPool
}

function escapeIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid table name: ${identifier}`)
  }

  return identifier
}

export async function handler(event: Event) {
  const allowedTables = JSON.parse(process.env.ALLOWED_TABLES || "[]")

  if (!allowedTables.includes(event.type)) {
    throw new Error(`Invalid table name: ${event.type}`)
  }

  const features = featuresSchema.parse(
    JSON.parse(await storage.getObjectText(event.bucket, event.key))
  )

  await batchInsertFeatures(features, event.id, event.category, event.type)
  return { indexed: features.length }
}

async function batchInsertFeatures(
  features: number[][],
  id: string,
  category: string,
  table: string
) {
  const chunks = chunkFeatures(features, id, category)
  const safeTable = escapeIdentifier(table)
  const client = await getPool().connect()

  try {
    await client.query("begin")
    await client.query(`delete from ${safeTable} where annotation_id = $1`, [
      id,
    ])
    for (const chunk of chunks) {
      const parameters: unknown[] = []
      const rows = chunk.map((feature) => {
        const offset = parameters.length
        parameters.push(
          feature.annotation_id,
          feature.feature_id,
          feature.category,
          `[${feature.embedding.join(",")}]`
        )
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::vector)`
      })

      await client.query(
        `
          insert into ${safeTable} (annotation_id, feature_id, category, embedding)
          values ${rows.join(", ")}
          on conflict (annotation_id, feature_id) do update
          set category = excluded.category,
              embedding = excluded.embedding
        `,
        parameters
      )
    }
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

function estimateRowSize(embedding: number[]) {
  return embedding.length * 8 + 200
}

type Chunk = {
  annotation_id: string
  feature_id: number
  category: string
  embedding: number[]
}[]

function chunkFeatures(features: number[][], id: string, category: string) {
  const chunks: Chunk[] = []
  let currentChunk: Chunk = []
  let currentSize = 0

  for (let i = 0; i < features.length; i++) {
    const embedding = features[i]
    const size = estimateRowSize(embedding)

    if (currentSize + size > TWO_MEGABYTES && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = []
      currentSize = 0
    }

    currentChunk.push({
      annotation_id: id,
      feature_id: i,
      category: category,
      embedding,
    })

    currentSize += size
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}
