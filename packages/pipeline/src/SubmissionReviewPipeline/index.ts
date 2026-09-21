// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../.sst/platform/config.d.ts" />

import { createRealtime } from "./createRealtime"
import { createSubmissionReviewStateMachine } from "./createStateMachine"
import { StateMachine } from "../StepFunction"

//TODO: maybe an api key renewal service?
export class SubmissionReviewPipeline extends $util.ComponentResource {
  private _bus: aws.cloudwatch.EventBus
  private _identityPool: aws.cognito.IdentityPool
  private _name: string
  private _realtime: aws.appsync.Api
  private _table: sst.aws.Dynamo
  private _pipeline?: StateMachine

  constructor(
    name: string,
    args: {
      notificationEmail: $util.Input<string>
    },
    opts?: $util.ComponentResourceOptions
  ) {
    super("finspotter:pipeline:SubmissionReviewPipeline", name, args, opts)

    this._name = name
    this._table = new sst.aws.Dynamo(`${name}Submissions`, {
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
          // TODO: project reviewer visibility and assignment fields when the review model lands.
          projection: ["locked_at", "expires", "final", "status"],
        },
        gsi2: {
          hashKey: "media_id",
          rangeKey: "sk",
          projection: [
            "category",
            "data",
            "expires",
            "score",
            "superseded_by",
            "type",
            "uri",
          ],
        },
      },
      ttl: "expires",
      stream: "new-image",
      // TODO: enable deletion protection outside ephemeral stages.
      transform: {
        table: (args) => {
          args.pointInTimeRecovery = { enabled: false }
        },
      },
    })

    const { bus, identityPool, realtime } = createRealtime(
      name,
      this._table,
      args.notificationEmail
    )
    this._bus = bus
    this._identityPool = identityPool
    this._realtime = realtime
  }

  public get bus() {
    return this._bus
  }

  public get eventBus() {
    return this._bus.arn
  }

  public get identityPool() {
    return this._identityPool.id
  }

  public get realtime() {
    return this._realtime
  }

  public get table() {
    return this._table
  }

  public orchestrate(mediaProcessing: StateMachine) {
    if (this._pipeline) {
      throw new Error("Submission review orchestration is already configured")
    }
    this._pipeline = createSubmissionReviewStateMachine(
      this._name,
      this._table,
      mediaProcessing
    )
    return this
  }

  public get pipeline() {
    if (!this._pipeline) {
      throw new Error("Submission review orchestration is not configured")
    }
    return this._pipeline.arn
  }
}

sst.Linkable.wrap(
  SubmissionReviewPipeline,
  (resource: SubmissionReviewPipeline) => ({
    properties: {
      eventBus: resource.eventBus,
      identityPool: resource.identityPool,
      pipeline: resource.pipeline,
      realtime: resource.realtime,
      table: resource.table.name,
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