import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

type DatabaseLink = sst.Linkable<{ host: $util.Output<string> }>

export function createAddFunction(
  tables: $util.Output<string[]>,
  bucket: sst.aws.Bucket,
  database: DatabaseLink
) {
  const fn = new sst.aws.Function("PgVectorAddFunction", {
    name: physicalName(256, "PgVectorAddFunction"),
    runtime: "nodejs22.x",
    handler: "extensions/pipeline/pgvector/src/add/index.handler",
    architecture: "x86_64",
    environment: {
      ALLOWED_TABLES: tables.apply((tables) => JSON.stringify([...tables])),
      DATABASE_URL: database.properties.host,
      ...($dev && {
        RUSTFS_ACCESS_KEY: process.env.RUSTFS_ACCESS_KEY,
        RUSTFS_SECRET_KEY: process.env.RUSTFS_SECRET_KEY,
      }),
    },
    memory: "256 MB",
    timeout: "90 seconds",
    link: [database, bucket],
  })

  return fn.nodes.function
}
