import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

type DatabaseLink = sst.Linkable<{ host: $util.Output<string> }>

export function createRemoveFunction(
  tables: $util.Output<string[]>,
  bucket: sst.aws.Bucket,
  table: sst.aws.Dynamo,
  database: DatabaseLink
) {
  return createPipelineFunction(
    "PgVectorRemove",
    {
      name: physicalName(256, "PgVectorRemoveFunction"),
      runtime: "nodejs22.x",
      handler: "extensions/pipeline/pgvector/src/remove/index.handler",
      architecture: "x86_64",
      environment: {
        ALLOWED_TABLES: tables.apply((tables) => JSON.stringify([...tables])),
        DATABASE_URL: database.properties.host,
      },
      memory: "256 MB",
      timeout: "90 seconds",
      link: [database],
    },
    bucket,
    table
  )
}
