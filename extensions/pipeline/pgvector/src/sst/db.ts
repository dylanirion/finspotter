const vpc = new sst.aws.Vpc("VectorDatabase")

export const db = new sst.aws.Aurora("Vector", {
  engine: "postgres",
  dataApi: true,
  scaling: { min: "0 ACU", max: "4 ACU" },
  vpc,
})
