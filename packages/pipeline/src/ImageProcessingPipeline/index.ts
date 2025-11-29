// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../.sst/platform/config.d.ts" />

import { writeFile } from "fs/promises"

import { secret } from "../../../../infra/secret"
import { StateMachine } from "../StepFunction"
import { physicalName } from "../StepFunction/sst-helpers"
import { createStateMachine } from "./createStateMachine"
import {
  type DetectionFunction,
  type ExtractionFunction,
  type MatchRefinementFunction,
  type PipelinePackage,
  type PipelinePackageWithAnnotation,
  type SearchFunction,
} from "./PipelinePackage"

export class ImageProcessingPipeline extends $util.ComponentResource {
  private _detectionFunctions: Record<string, ReturnType<DetectionFunction>>
  private _extractionFunctions: Record<string, ReturnType<ExtractionFunction>>
  private _searchFunctions: Record<string, ReturnType<SearchFunction>>
  private _refineFunctions: Record<string, ReturnType<MatchRefinementFunction>>
  private _pipeline: StateMachine
  private _identityPool: aws.cognito.IdentityPool
  private _eventBus: aws.cloudwatch.EventBus
  private _table: sst.aws.Dynamo
  //TODO: watch for AppSync Events API pulumi component, and hopefully Rule Target integration
  //NB: TEMPORARY SOLUTION: API KEY IS GOOD FOR 365 DAYS
  //TODO: https://docs.aws.amazon.com/appsync/latest/eventapi/using-waf-protect-apis.html
  private _realtime: awsnative.appsync.Api

  constructor(
    name: string,
    args: {
      packages: Array<PipelinePackage | PipelinePackageWithAnnotation>
      bucket: aws.s3.BucketV2
    },
    opts?: $util.ComponentResourceOptions
  ) {
    super("finspotter:pipeline:ImageProcessingPipeline", name, args, opts)

    generateExports(args.packages)
    const { bucket, packages } = args
    const table = createTable()
    const realtime = createEventsApi()
    const bus = createEventBus(table, realtime)

    const detectionFunctions = packages.reduce(
      (acc, { name, detect }) => {
        if (detect) acc[name] = detect({ bucket, table })
        return acc
      },
      {} as Record<string, ReturnType<DetectionFunction>>
    )
    const extractionFunctions = packages.reduce(
      (acc, { name, extract }) => {
        if (extract)
          acc[name] = extract({
            bucket,
            table,
          })
        return acc
      },
      {} as Record<string, ReturnType<ExtractionFunction>>
    )
    const searchFunctions = packages.reduce(
      (acc, { name, search }) => {
        if (search)
          for (const [type, fn] of Object.entries(search)) {
            acc[`${name}:${type}`] = fn({
              bucket,
              table,
              bus,
            })
          }
        return acc
      },
      {} as Record<string, ReturnType<SearchFunction>>
    )
    const refineFunctions = packages.reduce(
      (acc, { name, refine }) => {
        if (refine)
          acc[name] = refine({
            bucket,
            table,
          })
        return acc
      },
      {} as Record<string, ReturnType<MatchRefinementFunction>>
    )

    this._detectionFunctions = detectionFunctions
    this._extractionFunctions = extractionFunctions
    this._searchFunctions = searchFunctions
    this._refineFunctions = refineFunctions
    this._realtime = realtime
    this._identityPool = createIdentityPool(this._realtime)
    this._table = table
    this._eventBus = bus
    this._pipeline = createStateMachine(name, this._table)
    createRolePolicies(this._pipeline.role)

    function createRolePolicies(role: aws.iam.Role) {
      if (
        Object.values(detectionFunctions).length ||
        Object.values(extractionFunctions).length ||
        Object.values(searchFunctions).length ||
        Object.values(refineFunctions).length
      ) {
        new aws.iam.RolePolicy(
          `${name}InvokeFnsSfnRolePolicy`,
          {
            name: physicalName(256, `${name}InvokeFnsSfnRolePolicy`),
            role: role.name,
            policy: $util
              .all(
                Object.values({
                  ...(detectionFunctions ?? {}),
                  ...(extractionFunctions ?? {}),
                  ...(searchFunctions ?? {}),
                  ...(refineFunctions ?? {}),
                }).map((func) => func.arn)
              )
              .apply(async (arns) =>
                aws.iam
                  .getPolicyDocument({
                    version: "2012-10-17",
                    statements: [
                      {
                        effect: "Allow",
                        actions: ["lambda:InvokeFunction"],
                        resources: arns,
                      },
                      {
                        effect: "Allow",
                        actions: [
                          "logs:CreateLogDelivery",
                          "logs:GetLogDelivery",
                          "logs:UpdateLogDelivery",
                          "logs:DeleteLogDelivery",
                          "logs:ListLogDeliveries",
                          "logs:PutResourcePolicy",
                          "logs:DescribeResourcePolicies",
                          "logs:DescribeLogGroups",
                        ],
                        resources: ["*"],
                      },
                    ],
                  })
                  .then((doc) => doc.json)
              ),
          },
          { parent: role }
        )
      }
    }

    function createTable() {
      return new sst.aws.Dynamo(`${name}Submissions`, {
        fields: {
          pk: "string",
          sk: "string",
          gsi1pk: "string",
          media_id: "string",
          created_at: "string",
        },
        primaryIndex: { hashKey: "pk", rangeKey: "sk" },
        globalIndexes: {
          gsi1: {
            hashKey: "gsi1pk",
            rangeKey: "created_at",
            //TODO: this should also project reviewers array and visibility
            projection: ["locked_at", "expires", "final", "status"],
          },
          gsi2: {
            hashKey: "media_id",
            rangeKey: "sk",
            projection: ["category", "data", "expires", "score", "superseded_by", "type", "uri"],
          },
        },
        ttl: "expires",
        stream: "new-image",
        //TODO: deletion protection for production
        transform: {
          table: (args) => {
            args.pointInTimeRecovery = { enabled: false }
          },
        },
      })
    }

    function createEventsApi() {
      const eventsApi = new awsnative.appsync.Api(`${name}Events`, {
        name: physicalName(256, `${name}Events`),
        eventConfig: {
          authProviders: [{ authType: "AWS_IAM" }, { authType: "API_KEY" }],
          connectionAuthModes: [{ authType: "AWS_IAM" }],
          defaultPublishAuthModes: [{ authType: "AWS_IAM" }],
          defaultSubscribeAuthModes: [{ authType: "AWS_IAM" }],
        },
      })
      new awsnative.appsync.ChannelNamespace(`${name}EventsChannel`, {
        apiId: eventsApi.apiId,
        name: "pipeline",
        publishAuthModes: [{ authType: "API_KEY" }],
      })
      return eventsApi
    }

    function createIdentityPool(eventsApi: awsnative.appsync.Api) {
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
              //could get this from the ChannelNamespace object
              Resource: [
                $interpolate`${eventsApi.apiArn}/channelNamespace/pipeline`,
              ],
            },
          ],
        },
      })

      new aws.cognito.IdentityPoolRoleAttachment(
        `${name}identityPoolRoleAttachment`,
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
      table: sst.aws.Dynamo,
      eventsApi: awsnative.appsync.Api
    ) {
      const oneYear = new Date()
      oneYear.setFullYear(oneYear.getFullYear() + 1)
      const apiKey = new aws.appsync.ApiKey(`${name}EventsApiKey`, {
        apiId: eventsApi.apiId,
        expires: oneYear.toISOString(),
      })

      //while we are limited to API key instead of IAM, add an event to warn prior to expiry
      const topic = new sst.aws.SnsTopic("ApiKeyExpiry")
      new aws.sns.TopicSubscription("ApiKeyExpirySub", {
        topic: topic.arn,
        protocol: "email",
        endpoint: secret.EmailUser.value,
      })

      const oneWeekBefore = new Date(oneYear)
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7)

      const schedulerRole = new aws.iam.Role("schedulerRole", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "scheduler.amazonaws.com",
        }),
      })
      new aws.iam.RolePolicy("schedulerPolicy", {
        role: schedulerRole,
        policy: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sns:Publish",
              Resource: [topic.arn],
              Effect: "Allow",
            },
          ],
        },
      })
      new aws.scheduler.Schedule("ApiKeyExpiryWarning", {
        name: `${name}ApiKeyExpiryWarning`,
        flexibleTimeWindow: {
          mode: "OFF",
        },
        scheduleExpression: `at(${oneWeekBefore.toISOString().split(".")[0]})`,
        target: {
          arn: topic.arn,
          roleArn: schedulerRole.arn,
          input: JSON.stringify({
            Message:
              "This is a warning that the AppSync Events API Key currently used by Fin Spotter expires in 7 days!",
          }),
        },
      })

      const bus = new aws.cloudwatch.EventBus(`${name}EventBus`, {
        name: physicalName(256, `${name}EventBus`),
      })

      //TODO: Watch out for AppSync Events API Rule Target integration with IAM auth
      //https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html
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

      const destinationRole = new aws.iam.Role("ApiDestinationRole", {
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

      const pipeRole = new aws.iam.Role("SubmissionTablePipeRole", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "pipes.amazonaws.com",
        }),
      })

      new aws.iam.RolePolicy("SubmissionTablePipeRolePolicy", {
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

      new aws.pipes.Pipe("Submissions", {
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
            //source: [$util.interpolate`Pipe ${pipe.name}`],
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
            //source: [$util.interpolate`Pipe ${pipe.name}`],
            detail: {
              $or: [
                {
                  dynamodb: {
                    NewImage: {
                      sk: {
                        S: [{ prefix: "detection" }, { prefix: "extraction" }],
                      },
                      gsi1pk: {
                        S: ["result"],
                      },
                    },
                  },
                },
                {
                  dynamodb: {
                    NewImage: {
                      sk: {
                        S: [{ prefix: "search" }],
                      },
                      score: {
                        N: [{ exists: true }],
                      },
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
            //TODO: get type
            //type: "$.detail-type",
            key: "$.detail.dynamodb.NewImage.sk.S",
          },
          //inputTemplate: `{"channel": "pipeline/<pk>", "events": ["{\\"type\\": \\"<type>\\", \\"invalidate\\": <key>}"]}`,
          inputTemplate: `{"channel": "pipeline/<pk>", "events": ["{\\"invalidate\\": \\"<key>\\"}"]}`,
        },
        roleArn: destinationRole.arn,
      })

      return bus
    }
  }

  public get pipeline() {
    return this._pipeline.arn
  }

  public get eventBus() {
    return this._eventBus.arn
  }

  public get realtime() {
    return this._realtime
  }

  public get table() {
    return this._table
  }

  public get identityPool() {
    return this._identityPool.id
  }

  public get detectionFunctions() {
    return Object.entries(this._detectionFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }

  public get extractionFunctions() {
    return Object.entries(this._extractionFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }

  public get searchFunctions() {
    return Object.entries(this._searchFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }

  public get refineFunctions() {
    return Object.entries(this._refineFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }
}

//TODO: format with prettier?
function generateExports(mods: PipelinePackage[]) {
  writeFile(
    "./packages/pipeline/src/index.ts", //TODO: detect this location?
    [
      `/* This file is auto-generated by @finspotter/pipeline. Do not edit. */`,
      "",
      `import { type AnnotationType } from "@finspotter/annotations"`,
      "",
      //Detection
      `export const DetectionFunctions = [`,
      ...mods.filter((mod) => mod.detect).map((mod) => `  "${mod.name}",`),
      `] as const`,
      `export type DetectionFunction = (typeof DetectionFunctions)[number]`,
      "",
      `interface DetectConfigs {`,
      ...mods
        .filter((mod) => mod.detect)
        .map((mod) => `  ${mod.name}: ${mod.configType}`),
      `}`,
      `export type DetectConfig<D extends DetectionFunction | undefined> =`,
      `  D extends DetectionFunction ? DetectConfigs[D] : never`,
      //Extraction
      "",
      `export const ExtractionFunctions = [`,
      ...mods.filter((mod) => mod.extract).map((mod) => `  "${mod.name}",`),
      `] as const`,
      `export type ExtractionFunction = (typeof ExtractionFunctions)[number]`,
      "",
      `interface ExtractConfigs {`,
      ...mods
        .filter((mod) => mod.extract)
        .map((mod) => `  ${mod.name}: ${mod.configType}`),
      `}`,
      "",
      `export type ExtractConfig<E extends ExtractionFunction | undefined> =`,
      `  E extends ExtractionFunction ? ExtractConfigs[E] : never`,
      //Search
      "",
      `export const SearchFunctions = [`,
      ...mods
        .filter((mod) => mod.search)
        .flatMap(({ name, search }) =>
          Object.keys(search!).map((type) => `  "${name}:${type}",`)
        ),
      `] as const`,
      `export type SearchFunction = (typeof SearchFunctions)[number]`,
      "",
      `interface SearchConfigs {`,
      ...mods
        .filter((mod) => mod.search)
        .flatMap(({ name, configType }) =>
          Object.entries(configType!).map(
            ([type, config]) => `  "${name}:${type}": ${config}`
          )
        ),
      `}`,
      `export type SearchConfig<S extends SearchFunction | undefined> =`,
      `  S extends SearchFunction ? SearchConfigs[S] : never`,
      //Match Refinement
      "",
      `export const MatchRefinementFunctions = [`,
      ...mods.filter((mod) => mod.refine).map((mod) => `  "${mod.name}",`),
      `] as const`,
      `export type MatchRefinementFunction = (typeof MatchRefinementFunctions)[number]`,
      "",
      `interface RefineConfigs {`,
      ...mods
        .filter((mod) => mod.refine)
        .map((mod) => `  ${mod.name}: ${mod.configType}`),
      `}`,
      "",
      `export type RefineConfig<R extends MatchRefinementFunction | undefined> =`,
      `  R extends MatchRefinementFunction ? RefineConfigs[R] : never`,
      // Detection/Extraction annotations
      "",
      `export const getAnnotationTypes: Record<string, AnnotationType> = {`,
      ...mods
        .filter((mod) => "annotationType" in mod)
        .map((mod) => `  ${mod.name}: "${mod.annotationType}",`),
      `}`,
      "",
      `export type AnnotationTypes = {`,
      ...mods
        .filter((mod) => "annotationType" in mod)
        .map((mod) => `  ${mod.name}: "${mod.annotationType}"`),
      `}`,
      "",
    ].join("\n")
  )
}

sst.Linkable.wrap(
  ImageProcessingPipeline,
  (resource: ImageProcessingPipeline) => ({
    properties: {
      realtime: resource.realtime,
      table: resource.table.name,
      identityPool: resource.identityPool,
      pipeline: resource.pipeline,
      detectionFunctions: resource.detectionFunctions,
      extractionFunctions: resource.extractionFunctions,
      searchFunctions: resource.searchFunctions,
      refineFunctions: resource.refineFunctions,
    },
    include: [
      sst.aws.permission({
        actions: ["states:StartExecution"],
        resources: [resource.pipeline],
      }),
      sst.aws.permission({
        actions: [
          "dynamodb:BatchWriteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
        ],
        resources: [
          resource.table.arn,
          $util.interpolate`${resource.table.arn}/*`,
        ],
      }),
    ],
  })
)
