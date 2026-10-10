import path from "node:path"

const project = new neon.Project("NeonProject", {
  name: `${$app.name}-${$app.stage}`,
  pgVersion: 18,
  //regionId: `aws-{aws.getRegionOutput().region}`,
  regionId: "aws-eu-central-1",
  historyRetentionSeconds: 0,
})

//TODO: share single prod owned project, and add dev branch?

const postgis = new command.local.Command(
  "EnablePostgis",
  {
    create: "node scripts/enable-postgis.mjs",
    dir: path.join($cli.paths.root, "packages/core"),
    environment: {
      DATABASE_URL: project.connectionUri,
    },
    triggers: [project.id, "postgis-v1"],
  },
  {
    dependsOn: project,
    additionalSecretOutputs: ["stdout", "stderr"],
  }
)

export const db = new sst.Linkable("Database", {
  properties: {
    host: $util
      .all([project.connectionUri, postgis.urn])
      .apply(([connectionUri]) => connectionUri),
  },
})
