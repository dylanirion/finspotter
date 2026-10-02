import { physicalName } from "../StepFunction/sst-helpers"

type DatabaseLink = sst.Linkable<{ host: $util.Output<string> }>

export function createRealtime(
  name: string,
  table: sst.aws.Dynamo,
  notificationEmail: $util.Input<string>,
  database: DatabaseLink
) {
  const realtime = createEventsApi(name)
  const identityPool = createIdentityPool(name, realtime)
  const { bus, pairJobGenerator } = createEventBus(
    name,
    table,
    realtime,
    notificationEmail,
    database
  )

  return { bus, identityPool, pairJobGenerator, realtime }
}

function createEventsApi(name: string) {
  // TODO: protect the public Events API with WAF once AppSync supports the intended rules.
  const eventsApi = new aws.appsync.Api(`${name}Events`, {
    name: physicalName(256, `${name}Events`),
    eventConfig: {
      authProviders: [{ authType: "AWS_IAM" }, { authType: "API_KEY" }],
      connectionAuthModes: [{ authType: "AWS_IAM" }],
      defaultPublishAuthModes: [{ authType: "AWS_IAM" }],
      defaultSubscribeAuthModes: [{ authType: "AWS_IAM" }],
    },
  })

  new aws.appsync.ChannelNamespace(`${name}EventsChannel`, {
    apiId: eventsApi.apiId,
    name: "pipeline",
    publishAuthModes: [{ authType: "API_KEY" }],
  })

  return eventsApi
}

function createIdentityPool(name: string, eventsApi: aws.appsync.Api) {
  const identityPool = new aws.cognito.IdentityPool(`${name}IdentityPool`, {
    identityPoolName: physicalName(256, `${name}IdentityPool`),
    allowUnauthenticatedIdentities: true,
  })
  const unauthRole = new aws.iam.Role(`${name}UnauthRole`, {
    assumeRolePolicy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Federated: "cognito-identity.amazonaws.com",
          },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.id,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "unauthenticated",
            },
          },
        },
      ],
    },
  })

  new aws.iam.RolePolicy(`${name}UnauthPolicy`, {
    role: unauthRole.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["appsync:EventConnect"],
          Resource: [$interpolate`${eventsApi.apiArn}`],
        },
        {
          Effect: "Allow",
          Action: ["appsync:EventSubscribe"],
          Resource: [
            $interpolate`${eventsApi.apiArn}/channelNamespace/pipeline`,
          ],
        },
      ],
    },
  })

  new aws.cognito.IdentityPoolRoleAttachment(
    `${name}IdentityPoolRoleAttachment`,
    {
      identityPoolId: identityPool.id,
      roles: {
        unauthenticated: unauthRole.arn,
      },
    }
  )

  return identityPool
}

function createEventBus(
  name: string,
  table: sst.aws.Dynamo,
  eventsApi: aws.appsync.Api,
  notificationEmail: $util.Input<string>,
  database: DatabaseLink
) {
  // AppSync Events API keys currently have a maximum 365-day lifetime.
  const oneYear = new Date()
  oneYear.setFullYear(oneYear.getFullYear() + 1)
  const apiKey = new aws.appsync.ApiKey(`${name}EventsApiKey`, {
    apiId: eventsApi.apiId,
    expires: oneYear.toISOString(),
  })
  createApiKeyExpiryWarning(name, oneYear, notificationEmail)

  const bus = new aws.cloudwatch.EventBus(`${name}EventBus`, {
    name: physicalName(256, `${name}EventBus`),
  })
  // TODO: replace API-key delivery with IAM when AppSync supports EventBridge targets.
  const connection = new aws.cloudwatch.EventConnection(
    `${name}EventsApiConnection`,
    {
      name: physicalName(256, `${name}EventsApiConnection`),
      authorizationType: "API_KEY",
      authParameters: {
        apiKey: {
          key: "x-api-key",
          value: apiKey.key,
        },
      },
    }
  )
  const destination = new aws.cloudwatch.EventApiDestination(
    `${name}EventsApiDestination`,
    {
      name: physicalName(256, `${name}EventsApiDestination`),
      connectionArn: connection.arn,
      httpMethod: "POST",
      invocationEndpoint: $interpolate`https://${eventsApi.dns.http}/event`,
    }
  )
  const destinationRole = new aws.iam.Role(`${name}ApiDestinationRole`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "events.amazonaws.com",
    }),
  })

  new aws.iam.RolePolicy(`${name}ApiDestinationRolePolicy`, {
    role: destinationRole.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "events:InvokeApiDestination",
          Resource: [destination.arn.apply(async (arn) => arn)],
          Effect: "Allow",
        },
      ],
    },
  })

  const pipeRole = new aws.iam.Role(`${name}SubmissionTablePipeRole`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "pipes.amazonaws.com",
    }),
  })

  new aws.iam.RolePolicy(`${name}SubmissionTablePipeRolePolicy`, {
    role: pipeRole.name,
    policy: $util
      .all([table.nodes.table.streamArn, bus.arn])
      .apply(([streamArn, eventBusArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: [
                "dynamodb:DescribeStream",
                "dynamodb:GetRecords",
                "dynamodb:GetShardIterator",
                "dynamodb:ListStreams",
              ],
              Effect: "Allow",
              Resource: streamArn,
            },
            {
              Action: ["events:PutEvents"],
              Effect: "Allow",
              Resource: eventBusArn,
            },
          ],
        })
      ),
  })

  new aws.pipes.Pipe(`${name}SubmissionsPipe`, {
    name: physicalName(256, `${name}Submissions`),
    roleArn: pipeRole.arn,
    source: table.nodes.table.streamArn,
    target: bus.arn,
    sourceParameters: {
      dynamodbStreamParameters: {
        batchSize: 1,
        startingPosition: "TRIM_HORIZON",
      },
    },
  })

  const statusRule = new aws.cloudwatch.EventRule(
    `${name}StatusEventRule`,
    {
      name: physicalName(256, `${name}StatusEventRule`),
      eventBusName: bus.name,
      eventPattern: JSON.stringify({
        detail: { dynamodb: { NewImage: { sk: { S: ["status"] } } } },
      }),
    }
  )
  const resultRule = new aws.cloudwatch.EventRule(
    `${name}InvalidationEventRule`,
    {
      name: physicalName(256, `${name}InvalidationEventRule`),
      eventBusName: bus.name,
      eventPattern: JSON.stringify({
        detail: {
          dynamodb: {
            NewImage: {
              sk: {
                S: [{ prefix: "detection" }, { prefix: "extraction" }],
              },
              gsi1pk: { S: ["result"] },
            },
          },
        },
      }),
    }
  )
  const reviewReadyRule = new aws.cloudwatch.EventRule(
    `${name}ReviewReadyEventRule`,
    {
      name: physicalName(256, `${name}ReviewReadyEventRule`),
      eventBusName: bus.name,
      eventPattern: JSON.stringify({
        detail: {
          dynamodb: {
            NewImage: {
              item_type: { S: ["pair_result"] },
              review_status: { S: ["ready"] },
              review_score: { N: [{ exists: true }] },
            },
          },
        },
      }),
    }
  )
  const autoReviewedExtractionRule = new aws.cloudwatch.EventRule(
    `${name}AutoReviewedExtractionEventRule`,
    {
      name: physicalName(64, `${name}AutoReview`),
      eventBusName: bus.name,
      eventPattern: JSON.stringify({
        detail: {
          dynamodb: {
            NewImage: {
              sk: { S: [{ prefix: "extraction#" }] },
              auto_review: { BOOL: [true] },
              annotation_id: { S: [{ exists: true }] },
              reviewed_by: { S: [{ exists: true }] },
              reviewed_at: { S: [{ exists: true }] },
            },
          },
        },
      }),
    }
  )
  const terminalResultRule = new aws.cloudwatch.EventRule(
    `${name}TerminalResultEventRule`,
    {
      name: physicalName(64, `${name}TerminalResult`),
      eventBusName: bus.name,
      eventPattern: JSON.stringify({
        detail: {
          dynamodb: {
            NewImage: {
              sk: {
                S: [
                  { prefix: "media#" },
                  { prefix: "detection#" },
                  { prefix: "extraction#" },
                ],
              },
              gsi1pk: { S: ["result"] },
              final: { BOOL: [true] },
              review_status: { S: ["ready"] },
              review_ready_at: { S: [{ exists: true }] },
            },
          },
        },
      }),
    }
  )
  const extractionRule = new aws.cloudwatch.EventRule(
    `${name}ExtractionPairJobRule`,
    {
      name: physicalName(256, `${name}ExtractionPairJobRule`),
      eventBusName: bus.name,
      eventPattern: JSON.stringify({
        detail: {
          dynamodb: {
            NewImage: {
              sk: { S: [{ prefix: "extraction#" }] },
              gsi1pk: { S: ["result"] },
            },
          },
        },
      }),
    }
  )
  const pairJobGenerator = new sst.aws.Function(`${name}PairJobGenerator`, {
    handler: "packages/pipeline/src/pairJobs/index.handler",
    dev: false,
    timeout: "30 seconds",
    environment: {
      TABLE: table.name,
      PAIRWISE_ALGORITHM: "faiss:pairwise:v1",
    },
    permissions: [
      {
        actions: [
          "dynamodb:BatchGetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
        ],
        resources: [table.arn],
      },
    ],
  })
  const resultProjector = new sst.aws.Function(`${name}ResultProjector`, {
    handler: "packages/pipeline/src/resultProjector/index.handler",
    dev: false,
    timeout: "30 seconds",
    link: [database],
  })
  const resultProjectorDeadLetterQueue = new aws.sqs.Queue(
    `${name}ResultProjectorDeadLetterQueue`,
    {
      name: physicalName(80, `${name}ResultProjectorFailures`),
      messageRetentionSeconds: 14 * 24 * 60 * 60,
      sqsManagedSseEnabled: true,
    }
  )

  new aws.sqs.QueuePolicy(`${name}ResultProjectorDeadLetterQueuePolicy`, {
    queueUrl: resultProjectorDeadLetterQueue.url,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowEventBridgeDelivery",
          Effect: "Allow",
          Principal: { Service: "events.amazonaws.com" },
          Action: "sqs:SendMessage",
          Resource: resultProjectorDeadLetterQueue.arn,
          Condition: {
            ArnEquals: { "aws:SourceArn": reviewReadyRule.arn },
          },
        },
        {
          Sid: "AllowAutoReviewedExtractionDelivery",
          Effect: "Allow",
          Principal: { Service: "events.amazonaws.com" },
          Action: "sqs:SendMessage",
          Resource: resultProjectorDeadLetterQueue.arn,
          Condition: {
            ArnEquals: { "aws:SourceArn": autoReviewedExtractionRule.arn },
          },
        },
        {
          Sid: "AllowTerminalResultDelivery",
          Effect: "Allow",
          Principal: { Service: "events.amazonaws.com" },
          Action: "sqs:SendMessage",
          Resource: resultProjectorDeadLetterQueue.arn,
          Condition: {
            ArnEquals: { "aws:SourceArn": terminalResultRule.arn },
          },
        },
      ],
    },
  })

  new aws.lambda.Permission(`${name}PairJobGeneratorPermission`, {
    action: "lambda:InvokeFunction",
    function: pairJobGenerator.nodes.function.name,
    principal: "events.amazonaws.com",
    sourceArn: extractionRule.arn,
  })

  new aws.cloudwatch.EventTarget(`${name}ExtractionPairJobTarget`, {
    targetId: physicalName(256, `${name}ExtractionPairJobTarget`),
    eventBusName: bus.name,
    rule: extractionRule.name,
    arn: pairJobGenerator.nodes.function.arn,
    inputTransformer: {
      inputPaths: {
        pk: "$.detail.dynamodb.NewImage.pk.S",
        sk: "$.detail.dynamodb.NewImage.sk.S",
        mediaId: "$.detail.dynamodb.NewImage.media_id.S",
        detectionId: "$.detail.dynamodb.NewImage.detection_id.S",
        bucket:
          "$.detail.dynamodb.NewImage.uri.M.features.M.bucket.S",
        key: "$.detail.dynamodb.NewImage.uri.M.features.M.key.S",
      },
      inputTemplate:
        '{"pk":"<pk>","sk":"<sk>","media_id":"<mediaId>","detection_id":"<detectionId>","bucket":"<bucket>","key":"<key>"}',
    },
  })

  new aws.lambda.Permission(`${name}ResultProjectorPermission`, {
    action: "lambda:InvokeFunction",
    function: resultProjector.nodes.function.name,
    principal: "events.amazonaws.com",
    sourceArn: reviewReadyRule.arn,
  })

  new aws.cloudwatch.EventTarget(`${name}ResultProjectorTarget`, {
    targetId: physicalName(256, `${name}ResultProjectorTarget`),
    eventBusName: bus.name,
    rule: reviewReadyRule.name,
    arn: resultProjector.nodes.function.arn,
    deadLetterConfig: { arn: resultProjectorDeadLetterQueue.arn },
    retryPolicy: {
      maximumEventAgeInSeconds: 60 * 60,
      maximumRetryAttempts: 10,
    },
  })

  new aws.lambda.Permission(`${name}ExtractionProjectorPermission`, {
    action: "lambda:InvokeFunction",
    function: resultProjector.nodes.function.name,
    principal: "events.amazonaws.com",
    sourceArn: autoReviewedExtractionRule.arn,
  })

  new aws.cloudwatch.EventTarget(`${name}ExtractionProjectorTarget`, {
    targetId: physicalName(64, `${name}AutoReviewTarget`),
    eventBusName: bus.name,
    rule: autoReviewedExtractionRule.name,
    arn: resultProjector.nodes.function.arn,
    deadLetterConfig: { arn: resultProjectorDeadLetterQueue.arn },
    retryPolicy: {
      maximumEventAgeInSeconds: 60 * 60,
      maximumRetryAttempts: 10,
    },
  })

  new aws.lambda.Permission(`${name}TerminalResultProjectorPermission`, {
    action: "lambda:InvokeFunction",
    function: resultProjector.nodes.function.name,
    principal: "events.amazonaws.com",
    sourceArn: terminalResultRule.arn,
  })

  new aws.cloudwatch.EventTarget(`${name}TerminalResultProjectorTarget`, {
    targetId: physicalName(64, `${name}TerminalResultTarget`),
    eventBusName: bus.name,
    rule: terminalResultRule.name,
    arn: resultProjector.nodes.function.arn,
    deadLetterConfig: { arn: resultProjectorDeadLetterQueue.arn },
    retryPolicy: {
      maximumEventAgeInSeconds: 60 * 60,
      maximumRetryAttempts: 10,
    },
  })

  new aws.cloudwatch.EventTarget(`${name}StatusEventsApiTarget`, {
    targetId: physicalName(256, `${name}StatusTarget`),
    eventBusName: bus.name,
    rule: statusRule.name,
    arn: destination.arn,
    httpTarget: {
      headerParameters: {
        "Content-Type": "application/json",
      },
    },
    inputTransformer: {
      inputPaths: {
        pk: "$.detail.dynamodb.Keys.pk.S",
        status: "$.detail.dynamodb.NewImage.status.S",
        created_at: "$.detail.dynamodb.NewImage.created_at.S",
        updated_at: "$.detail.dynamodb.NewImage.updated_at.S",
      },
      inputTemplate: `{"channel": "pipeline/<pk>", "events": ["{\\"pk\\": \\"<pk>\\", \\"status\\": \\"<status>\\", \\"created_at\\": \\"<created_at>\\"}"]}`,
    },
    roleArn: destinationRole.arn,
  })

  new aws.cloudwatch.EventTarget(`${name}InvalidationEventsApiTarget`, {
    targetId: physicalName(256, `${name}InvalidationTarget`),
    eventBusName: bus.name,
    rule: resultRule.name,
    arn: destination.arn,
    httpTarget: {
      headerParameters: {
        "Content-Type": "application/json",
      },
    },
    inputTransformer: {
      inputPaths: {
        pk: "$.detail.dynamodb.Keys.pk.S",
        // TODO: include the result type in invalidation events.
        key: "$.detail.dynamodb.NewImage.sk.S",
      },
      inputTemplate: `{"channel": "pipeline/<pk>", "events": ["{\\"invalidate\\": \\"<key>\\"}"]}`,
    },
    roleArn: destinationRole.arn,
  })

  new aws.cloudwatch.EventTarget(`${name}ReviewReadyEventsApiTarget`, {
    targetId: physicalName(256, `${name}ReviewReadyTarget`),
    eventBusName: bus.name,
    rule: reviewReadyRule.name,
    arn: destination.arn,
    httpTarget: {
      headerParameters: {
        "Content-Type": "application/json",
      },
    },
    inputTransformer: {
      inputPaths: {
        pk: "$.detail.dynamodb.Keys.pk.S",
        key: "$.detail.dynamodb.NewImage.sk.S",
        score: "$.detail.dynamodb.NewImage.review_score.N",
        queryMediaId:
          "$.detail.dynamodb.NewImage.query.M.media_id.S",
        queryDetectionId:
          "$.detail.dynamodb.NewImage.query.M.detection_id.S",
        refMediaId: "$.detail.dynamodb.NewImage.ref.M.media_id.S",
        refDetectionId:
          "$.detail.dynamodb.NewImage.ref.M.detection_id.S",
        readyAt: "$.detail.dynamodb.NewImage.review_ready_at.S",
      },
      inputTemplate: `{"channel": "pipeline/<pk>", "events": ["{\\"type\\":\\"review-ready\\",\\"key\\":\\"<key>\\",\\"score\\":<score>,\\"query\\":{\\"mediaId\\":\\"<queryMediaId>\\",\\"detectionId\\":\\"<queryDetectionId>\\"},\\"ref\\":{\\"mediaId\\":\\"<refMediaId>\\",\\"detectionId\\":\\"<refDetectionId>\\"},\\"readyAt\\":\\"<readyAt>\\"}"]}`,
    },
    roleArn: destinationRole.arn,
  })

  return { bus, pairJobGenerator: pairJobGenerator.nodes.function }
}

function createApiKeyExpiryWarning(
  name: string,
  expires: Date,
  notificationEmail: $util.Input<string>
) {
  const topic = new aws.sns.Topic(`${name}ApiKeyExpiryTopic`, {
    name: physicalName(256, `${name}ApiKeyExpiry`),
  })

  new aws.sns.TopicSubscription(`${name}ApiKeyExpirySubscription`, {
    topic: topic.arn,
    protocol: "email",
    endpoint: notificationEmail,
  })

  const schedulerRole = new aws.iam.Role(`${name}ApiKeyExpirySchedulerRole`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "scheduler.amazonaws.com",
    }),
  })

  new aws.iam.RolePolicy(`${name}ApiKeyExpirySchedulerPolicy`, {
    role: schedulerRole.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sns:Publish",
          Resource: topic.arn,
          Effect: "Allow",
        },
      ],
    },
  })

  const warningAt = new Date(expires)
  warningAt.setDate(warningAt.getDate() - 7)

  new aws.scheduler.Schedule(`${name}ApiKeyExpiryWarning`, {
    name: physicalName(256, `${name}ApiKeyExpiryWarning`),
    flexibleTimeWindow: {
      mode: "OFF",
    },
    scheduleExpression: `at(${warningAt.toISOString().split(".")[0]})`,
    target: {
      arn: topic.arn,
      roleArn: schedulerRole.arn,
      input: JSON.stringify({
        Message: `The ${name} AppSync Events API key expires in 7 days.`,
      }),
    },
  })
}