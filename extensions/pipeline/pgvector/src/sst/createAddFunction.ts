import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

type DatabaseLink = sst.Linkable<{ host: $util.Output<string> }>

export function createAddFunction(
  tables: $util.Output<string[]>,
  bucket: sst.aws.Bucket,
  database: DatabaseLink
) {
  const role = new aws.iam.Role("PgVectorAddRole", {
    name: physicalName(256, "PgVectorAddRole"),
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "lambda.amazonaws.com",
    }),
    managedPolicyArns: [
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    ],
    inlinePolicies: [
      {
        name: "featuresPolicy",
        policy: bucket.arn.apply((bucketArn) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: "s3:GetObject",
                Resource: `${bucketArn}/*`,
              },
            ],
          })
        ),
      },
    ],
  })

  const fn = new sst.aws.Function("PgVectorAddFunction", {
    name: physicalName(256, "PgVectorAddFunction"),
    runtime: "nodejs22.x",
    handler: "extensions/pipeline/pgvector/src/add/index.handler",
    architecture: "x86_64",
    environment: {
      ALLOWED_TABLES: tables.apply((tables) => JSON.stringify([...tables])),
      DATABASE_URL: database.properties.host,
    },
    memory: "256 MB",
    timeout: "90 seconds",
    role: role.arn,
    link: [database],
  })

  return fn.nodes.function
}
