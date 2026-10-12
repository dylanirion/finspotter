import { requireObjectPayload } from "@finspotter/pipeline/validation"
import { Pool } from "@neondatabase/serverless"

export type QueryEvent = {
  pk: string
  sk: string
  bucket: string
  key: string
  vector_uri: { bucket: string; key: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  include: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exclude?: Record<string, any>
  count?: number
}

type Payload = {
  pk: string
  sk: string
  bucket: string
  key: string
}

type Event = {
  submissionId: string
  payload: Payload
  expires: string
}

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

//TODO: this will take a list of embeddings and return n closest matches to each in the vector store
export async function handler(event: Event) {
  const payload = requireObjectPayload<Payload>(event, [
    "pk",
    "sk",
    "bucket",
    "key",
  ])
  const { pk, sk, bucket, key } = payload
  await getPool().query("select 1")
  return { pk, sk, bucket, key }
}
