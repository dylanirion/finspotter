import {
  BatchExecuteStatementCommand,
  RDSDataClient,
} from "@aws-sdk/client-rds-data"
import { Resource } from "sst"

const TWO_MEGABYTES = 2 * 1024 * 1024

type Event = {
  id: string
  type: string
  category: string
  bucket: string
  key: string
}

const rds = new RDSDataClient({
  logger: {
    ...console,
    debug(..._args: unknown[]) {},
    trace(..._args: unknown[]) {},
  },
  requestHandler: {
    requestTimeout: 3_000,
    httpsAgent: { maxSockets: 25 },
  },
})

export async function handler(event: Event) {
  const allowedTables = JSON.parse(process.env.ALLOWED_TABLES || "[]")

  if (!allowedTables.includes(event.type)) {
    throw new Error(`Invalid table name: ${event.type}`)
  }

  const { id, category } = event
  //TODO: read s3
  const features = []

  batchInsertFeatures(features, id, category)
  return {}
}

async function batchInsertFeatures(
  features: number[][],
  id: string,
  category: string
) {
  const chunks = chunkFeatures(features, id, category)

  for (const chunk of chunks) {
    const parameterSets = chunk.map((feature) => [
      {
        name: ":annotation_id",
        value: { stringValue: feature.annotation_id },
      },
      { name: ":feature_id", value: { longValue: feature.feature_id } },
      {
        name: ":category",
        value: { stringValue: feature.category },
      },
      {
        name: ":embedding",
        value: {
          arrayValue: {
            doubleValues: feature.embedding,
          },
        },
      },
    ])

    const result = await rds.send(
      new BatchExecuteStatementCommand({
        secretArn: Resource.Vector.secretArn,
        resourceArn: Resource.Vector.clusterArn,
        database: Resource.Vector.database,
        sql: `insert into ${event.type} (annotation_id, feature_id, category, embedding) values (:annotation_id, :feature_id, :category, :embedding)`,
        parameterSets,
      })
    )
    console.log(result)
  }
}

function estimateRowSize(embedding: number[]) {
  return embedding.length * 8 + 200 // 8 bytes per float + overhead
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
