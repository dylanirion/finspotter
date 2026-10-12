/** @module @finspotter/pgvector */
import path from "node:path"
import {
  PipelinePackage,
  type IndexedSearchFunction,
} from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"
import { type ZodType } from "zod"

import { pgVectorConfigSchema } from "./schema"
import { indexed } from "./sst"

type DatabaseLink = sst.Linkable<{ host: $util.Output<string> }>

function createOwnedDatabase(): DatabaseLink {
  const project = new neon.Project("PgVectorNeonProject", {
    name: `${$app.name}-${$app.stage}-pgvector`,
    pgVersion: 18,
    regionId: "aws-eu-central-1",
    historyRetentionSeconds: 0,
  })

  return new sst.Linkable("PgVectorDatabase", {
    properties: {
      host: project.connectionUri,
    },
  })
}

class PGVectorPipelinePackage implements Omit<
  PipelinePackage,
  "annotationType" | "setAnnotationType" | "search" | "configType"
> {
  public readonly pkg: string
  public readonly name: string
  public search?: { indexed: IndexedSearchFunction }
  public config: ZodType | Partial<Record<"indexed", ZodType>>
  private embeddings: Record<string, number> = {}

  constructor() {
    this.pkg = "@finspotter/pgvector"
    this.name = "pgvector"
    this.config = pgVectorConfigSchema
  }

  vector(embeddings: Record<string, number>, database?: DatabaseLink) {
    const resolvedDatabase = database ?? createOwnedDatabase()
    this.embeddings = embeddings

    this.search = {
      indexed: ({ bucket, table, bus }) => {
        const keys = Object.keys(this.embeddings)
        const schema = new command.local.Command(
          "ConfigurePgVector",
          {
            create: "node scripts/configure-pgvector.mjs",
            dir: path.join($cli.paths.root, "extensions/pipeline/pgvector"),
            environment: {
              DATABASE_URL: resolvedDatabase.properties.host,
              VECTOR_TABLES: JSON.stringify(embeddings),
            },
            triggers: [JSON.stringify(embeddings), "pgvector-schema-v1"],
          },
          {
            dependsOn: resolvedDatabase,
            additionalSecretOutputs: ["stdout", "stderr"],
          }
        )
        const tables = schema.urn.apply(() => keys)

        return indexed({
          bucket,
          table,
          bus,
          tables,
          database: resolvedDatabase,
        })
      },
    }
    return this
  }
}

export default new PGVectorPipelinePackage()
