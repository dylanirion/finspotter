import { physicalName } from "../StepFunction/sst-helpers"

export function createRealtime(
  name: string,
  table: sst.aws.Dynamo,
  notificationEmail: $util.Input<string>
) {
  const realtime = createEventsApi(name)
  const identityPool = createIdentityPool(name, realtime)
  const bus = createEventBus(name, table, realtime, notificationEmail)

  return { bus, identityPool, realtime }
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
  notificationEmail: $util.Input<string>
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
          $or: [
            {
              dynamodb: {
                NewImage: {
                  sk: {
                    S: [{ prefix: "detection" }, { prefix: "extraction" }],
                  },
                  gsi1pk: { S: ["result"] },
                },
              },
            },
            {
              dynamodb: {
                NewImage: {
                  sk: { S: [{ prefix: "search" }] },
                  score: { N: [{ exists: true }] },
                },
              },
            },
          ],
        },
      }),
    }
  )

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

  return bus
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