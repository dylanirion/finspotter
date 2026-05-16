import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

import { createAddMachine } from "./createAddMachine"
import { createAutoAddMachine } from "./createAutoAddMachine"
import { db } from "./db"

export const indexed = ({
  bucket,
  table,
  bus,
  tables,
}: {
  bucket: aws.s3.Bucket
  table: sst.aws.Dynamo
  bus: aws.cloudwatch.EventBus
  tables: $util.Output<string[]>
}) => {
  //TODO: return handlers to pipeline?

  const add = createAddMachine(tables)
  const autoAddMachine = createAutoAddMachine(table, add)

  const autoAddRole = new aws.iam.Role("PgVectorAutoAddRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "events.amazonaws.com",
    }),
  })

  new aws.iam.RolePolicy("PgVectorAutoAddPolicy", {
    role: autoAddRole.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "states:StartExecution",
          Resource: [autoAddMachine.arn],
          Effect: "Allow",
        },
      ],
    },
  })

  // technically there should be no reason for a temporary extraction result to be final unless intended, or demo search fails
  // but we will check in the step function
  const extractionResultRule = new aws.cloudwatch.EventRule(
    "PgVectorExtractionResultEventRule",
    {
      name: physicalName(256, "PgVectorExtractionResultEventRule"),
      eventBusName: bus.name,
      eventPattern: JSON.stringify({
        detail: {
          dynamodb: {
            NewImage: {
              sk: {
                S: [{ prefix: "extraction" }],
              },
              gsi1pk: {
                S: ["result"],
              },
              final: {
                BOOL: [true],
              },
              expires: {
                N: [{ exists: true }],
              },
            },
          },
        },
      }),
    }
  )

  new aws.cloudwatch.EventTarget("PgVectorAutoAddTarget", {
    targetId: physicalName(256, "PgVectorAutoAddTarget"),
    eventBusName: bus.name,
    rule: extractionResultRule.name,
    arn: autoAddMachine.arn,
    inputTransformer: {
      inputPaths: {
        pk: "$.detail.dynamodb.NewImage.pk.S",
        mediaId: "$.detail.dynamodb.NewImage.media_id.S",
        detectionId: "$.detail.dynamodb.NewImage.detection_id.S",
        type: "$.detail.dynamodb.NewImage.type.S",
        category: "$.detail.dynamodb.NewImage.category.S",
        bucket: "$.detail.dynamodb.NewImage.uri.M.features.M.bucket.S",
        key: "$.detail.dynamodb.NewImage.uri.M.features.M.key.S",
      },
      inputTemplate: `{"pk": <pk>, "id": "<mediaId>#<detectionId>", "type": <type>, "category": <category>, "bucket": <bucket>, "key": <key>}`,
    },
    roleArn: autoAddRole.arn,
  })

  return createPipelineFunction(
    "PgVector",
    {
      runtime: "nodejs22.x",
      handler: "extensions/pipeline/pgvector/src/indexed/index.handler",
      memory: "256 MB",
      architecture: "x86_64",
      environment: {
        ALLOWED_TABLES: tables.apply((tables) => JSON.stringify([...tables])),
      },
      timeout: "90 seconds",
      dev: false,
      link: [db],
    },
    bucket,
    table
  )
}
