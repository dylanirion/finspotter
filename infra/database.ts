const project = new neon.Project("NeonProject", {
  name: `${$app.name}-${$app.stage}`,
  pgVersion: 18,
  //regionId: `aws-{aws.getRegionOutput().region}`,
  regionId: "aws-eu-central-1",
  historyRetentionSeconds: 0,
})

export const db = new sst.Linkable("Database", {
  properties: {
    host: project.connectionUri,
  },
})
