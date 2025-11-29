const role = new aws.iam.Role(`BuildPairwiseSetRole`, {
  name: `${$app.name}-${$app.stage}-BuildPairwiseSetRole`,
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "lambda.amazonaws.com",
  }),
  managedPolicyArns: [
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  ],
})

const logGroup = new aws.cloudwatch.LogGroup("BuildPairwiseSetLog", {
  name: `/aws/lambda/${$app.name}-${$app.stage}-BuildPairwiseSetFunction`,
  retentionInDays: 3,
})

export const buildSet = new aws.lambda.Function("BuildPairwiseSet", {
  name: `${$app.name}-${$app.stage}-BuildPairwiseSetFunction`,
  runtime: "python3.13",
  handler: "app.lambda_handler",
  code: new $util.asset.AssetArchive({
    ".": new $util.asset.FileArchive("../../packages/pipeline/buildSet/"),
  }),
  architectures: ["x86_64"],
  memorySize: 256,
  role: role.arn,
  loggingConfig: {
    logFormat: "Text",
    logGroup: logGroup.name,
  },
  timeout: 90,
})
