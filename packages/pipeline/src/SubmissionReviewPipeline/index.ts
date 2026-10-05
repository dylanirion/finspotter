// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../.sst/platform/config.d.ts" />

import { createRealtime } from "./createRealtime"
import { createMediaProcessingJobStateMachine } from "./createMediaProcessingJob"
import {
  createPairJobDispatch,
  createPairJobRunnerStateMachine,
  type PairJobRunnerConfig,
} from "./createPairJobRunner"
import { createSubmissionReviewStateMachine } from "./createStateMachine"
import { StateMachine } from "../StepFunction"

type DatabaseLink = sst.Linkable<{ host: $util.Output<string> }>

//TODO: maybe an api key renewal service?
export class SubmissionReviewPipeline extends $util.ComponentResource {
  private _bus: aws.cloudwatch.EventBus
  private _identityPool: aws.cognito.IdentityPool
  private _name: string
  private _realtime: aws.appsync.Api
  private _table: sst.aws.Dynamo
  private _pipeline?: StateMachine
  private _mediaProcessingJob?: StateMachine
  private _pairJobRunner?: StateMachine
  private _pairJobGenerator: $util.Output<aws.lambda.Function>

  constructor(
    name: string,
    args: {
      database: DatabaseLink
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
          projection: ["status"],
        },
        gsi2: {
          hashKey: "media_id",
          rangeKey: "sk",
          projection: [
            "annotation_type",
            "category",
            "created_at",
            "data",
            "detection_id",
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

    const { bus, identityPool, pairJobGenerator, realtime } = createRealtime(
      name,
      this._table,
      args.notificationEmail,
      args.database,
    )
    this._bus = bus
    this._identityPool = identityPool
    this._pairJobGenerator = pairJobGenerator
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

  public orchestrate(
    mediaProcessing: StateMachine,
    similaritySearch: StateMachine,
    pairJobs?: PairJobRunnerConfig
  ) {
    if (this._pipeline) {
      throw new Error("Submission review orchestration is already configured")
    }
    this._pipeline = createSubmissionReviewStateMachine(
      this._name,
      this._table,
      mediaProcessing,
      similaritySearch,
      pairJobs ? this._pairJobGenerator : undefined
    )
    this._mediaProcessingJob = createMediaProcessingJobStateMachine(
      this._name,
      this._table,
      mediaProcessing
    )
    if (pairJobs) {
      this._pairJobRunner = createPairJobRunnerStateMachine(
        this._name,
        this._table,
        similaritySearch,
        pairJobs
      )
      createPairJobDispatch(this._name, this._bus, this._pairJobRunner)
    }
    return this
  }

  public get mediaProcessingJob() {
    if (!this._mediaProcessingJob) {
      throw new Error("Media processing job orchestration is not configured")
    }
    return this._mediaProcessingJob.arn
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
      mediaProcessingJob: resource.mediaProcessingJob,
      pipeline: resource.pipeline,
      realtime: resource.realtime,
      table: resource.table.name,
    },
    include: [
      sst.aws.permission({
        actions: ["states:StartExecution"],
        resources: [resource.pipeline, resource.mediaProcessingJob],
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