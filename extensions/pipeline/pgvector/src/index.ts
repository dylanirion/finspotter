/** @module @finspotter/pgvector */
import {
  ExecuteStatementCommand,
  RDSDataClient,
  type ExecuteStatementCommandOutput,
} from "@aws-sdk/client-rds-data"
import {
  PipelinePackage,
  type SearchFunction,
} from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"
import { type ZodType } from "zod"

import { pgVectorConfigSchema } from "./schema"
import { indexed } from "./sst"
import { db } from "./sst/db"

const rds = new RDSDataClient({})

//TODO: toggle data api during build only
//TODO: EnableHttpEndpointCommand, DisableHttpEndpointCommand @aws-sdk/client-rds

//TODO: functions for adding and removing vectors

class PGVectorPipelinePackage
  implements
    Omit<
      PipelinePackage,
      "annotationType" | "setAnnotationType" | "search" | "configType"
    >
{
  public readonly pkg: string
  public readonly name: string
  public search?: Record<"indexed", SearchFunction>
  public config: ZodType | Partial<Record<"indexed", ZodType>>
  private embeddings: Record<string, number> = {}

  constructor() {
    this.pkg = "@finspotter/pgvector"
    this.name = "pgvector"
    this.config = pgVectorConfigSchema
  }

  vector(embeddings: Record<string, number>) {
    this.embeddings = embeddings

    this.search = {
      indexed: ({ bucket, table, bus }) => {
        const dbReady = $util
          .all([db.database, db.secretArn, db.clusterArn])
          .apply(async ([database, secretArn, clusterArn]) => {
            //TODO: can this be managed with pulumi?
            await executeWithRetry(() =>
              rds.send(
                new ExecuteStatementCommand({
                  secretArn,
                  resourceArn: clusterArn,
                  database,
                  sql: "create extension if not exists vector",
                })
              )
            )
            return { database, secretArn, clusterArn }
          })

        const keys = Object.keys(this.embeddings)
        const tables = $util
          .all(
            keys.map((key) =>
              dbReady.apply(async ({ database, secretArn, clusterArn }) => {
                await executeWithRetry(() =>
                  rds.send(
                    new ExecuteStatementCommand({
                      secretArn,
                      resourceArn: clusterArn,
                      database,
                      sql: `create table if not exists ${key} (id bigserial primary key, annotation_id varchar(255) not null, feature_id integer not null, category varchar(255), embedding vector(${embeddings[key]}))`,
                    })
                  )
                )
                await Promise.all([
                  executeWithRetry(() =>
                    rds.send(
                      new ExecuteStatementCommand({
                        secretArn,
                        resourceArn: clusterArn,
                        database,
                        sql: `create index if not exists idx_hnsw on ${key} using hnsw (embedding vector_l2_ops)`,
                      })
                    )
                  ),
                  executeWithRetry(() =>
                    rds.send(
                      new ExecuteStatementCommand({
                        secretArn,
                        resourceArn: clusterArn,
                        database,
                        sql: `create index if not exists idx_annotation_id on ${key} (annotation_id)`,
                      })
                    )
                  ),
                  executeWithRetry(() =>
                    rds.send(
                      new ExecuteStatementCommand({
                        secretArn,
                        resourceArn: clusterArn,
                        database,
                        sql: `create index if not exists idx_category on ${key} (category)`,
                      })
                    )
                  ),
                ])
              })
            )
          )
          .apply(() => keys)

        return indexed({ bucket, table, bus, tables })
      },
    }
    return this
  }
}

async function executeWithRetry(
  executeFn: () => Promise<ExecuteStatementCommandOutput>,
  retries = 10,
  delay = 1000
) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await executeFn()
    } catch (err) {
      if (attempt === retries - 1) throw err
      await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt)))
    }
  }
}

export default new PGVectorPipelinePackage()
