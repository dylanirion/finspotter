import {
  ExecuteStatementCommand,
  RDSDataClient,
} from "@aws-sdk/client-rds-data"
import { Resource } from "sst"

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

const rds = new RDSDataClient({})

//TODO: this will take a list of embeddings and return n closest matches to each in the vector store
export async function handler(event: Event) {
  const { pk, sk, bucket, key } = event.payload
  console.log("test")
  /*
  db.execute(
    sql.raw(
      `create table if not exists ${key} (id bigserial primary key, annotation_id uuid not null, category varchar(255), embedding vector(${value}))`
    )
  )
  const similarity = sql<number>`1 - (${l2Distance(guides.embedding, embedding)})`
  const similarGuides = await db
    .select({ name: guides.title, url: guides.url, similarity })
    .from(guides)
    .where(gt(similarity, 0.5))
    .orderBy((t) => desc(t.similarity))
    .limit(4)
  */
  return { pk, sk, bucket, key }
}
