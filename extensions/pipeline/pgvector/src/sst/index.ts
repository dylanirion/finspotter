import { createPipelineFunction } from "@finspotter/pipeline/createPipelineFunction"
import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

import { createAddFunction } from "./createAddFunction"
import { createAddMachine } from "./createAddMachine"
import { createAutoAddMachine } from "./createAutoAddMachine"
import { createRemoveFunction } from "./createRemoveFunction"

type DatabaseLink = sst.Linkable<{ host: $util.Output<string> }>

export const indexed = ({
  bucket,
  table,
  bus,
  tables,
  database,
}: {
  bucket: sst.aws.Bucket
  table: sst.aws.Dynamo
  bus: aws.cloudwatch.EventBus
  tables: $util.Output<string[]>
  database: DatabaseLink
}) => {
  const add = createAddFunction(tables, bucket, database)
  const addMachine = createAddMachine(add)
  const remove = createRemoveFunction(tables, bucket, table, database)
  const autoAddMachine = createAutoAddMachine(addMachine)

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
              auto_review: {
                BOOL: [true],
              },
              annotation_id: {
                S: [{ exists: true }],
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
        annotationId: "$.detail.dynamodb.NewImage.annotation_id.S",
        type: "$.detail.dynamodb.NewImage.type.S",
        category: "$.detail.dynamodb.NewImage.category.S",
        bucket: "$.detail.dynamodb.NewImage.uri.M.features.M.bucket.S",
        key: "$.detail.dynamodb.NewImage.uri.M.features.M.key.S",
      },
      inputTemplate: `{"id":"<annotationId>","type":"<type>","category":"<category>","bucket":"<bucket>","key":"<key>"}`,
    },
    roleArn: autoAddRole.arn,
  })

  return {
    search: createPipelineFunction(
      "PgVector",
      {
        runtime: "nodejs22.x",
        handler: "extensions/pipeline/pgvector/src/indexed/index.handler",
        memory: "256 MB",
        architecture: "x86_64",
        environment: {
          ALLOWED_TABLES: tables.apply((tables) => JSON.stringify([...tables])),
          DATABASE_URL: database.properties.host,
        },
        timeout: "90 seconds",
        link: [database],
      },
      bucket,
      table
    ),
    add,
    remove,
  }
}
