import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

import { db } from "./db"

export function createAddFunction(tables: $util.Output<string[]>) {
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
        name: "rdsPolicy",
        policy: $util
          .all([db.clusterArn, db.secretArn])
          .apply(([clusterArn, secretArn]) =>
            aws.iam
              .getPolicyDocument({
                version: "2012-10-17",
                statements: [
                  {
                    effect: "Allow",
                    actions: ["rds-data:BatchExecuteStatement"],
                    resources: [clusterArn],
                  },
                  {
                    effect: "Allow",
                    actions: ["secretsmanager:GetSecretValue"],
                    resources: [secretArn],
                  },
                ],
              })
              .then((doc) => doc.json)
          ),
      },
    ],
  })

  return new sst.aws.Function("PgVectorAddFunction", {
    name: physicalName(256, "PgVectorAddFunction"),
    runtime: "nodejs22.x",
    handler: "extensions/pipeline/pgvector/src/add/index.handler",
    architecture: "x86_64",
    environment: {
      ALLOWED_TABLES: tables.apply((tables) => JSON.stringify([...tables])),
    },
    memory: "256 MB",
    timeout: "90 seconds",
    role: role.arn,
    dev: false,
    link: [db],
  })
}
