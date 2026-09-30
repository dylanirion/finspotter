import {
  $,
  Choice,
  Custom,
  Fail,
  Pass,
  StateMachine,
  StepFunctionInvoke,
  Succeed,
} from "../StepFunction"
import { physicalName } from "../StepFunction/sst-helpers"

export interface PairJobRunnerConfig {
  searchFunction: $util.Input<string>
  refinements: Array<{
    functionName: $util.Input<string>
    config: unknown
  }>
}

export function createPairJobRunnerStateMachine(
  name: string,
  table: sst.aws.Dynamo,
  similaritySearch: StateMachine,
  config: PairJobRunnerConfig
) {
  const logGroup = new aws.cloudwatch.LogGroup(`${name}PairJobRunnerLog`, {
    name: `/aws/sfn/${$app.name}-${$app.stage}-${name}PairJobRunner`,
    retentionInDays: 3,
  })
  const alreadyClaimed = new Succeed("Pair Job Already Claimed")
  const claim = new Custom("Claim Pair Job", {
    Type: "Task",
    Resource: "arn:aws:states:::dynamodb:updateItem",
    Parameters: {
      TableName: table.name.apply(async (tableName) => tableName),
      Key: {
        pk: { "S.$": $.stringAt("$.pk") },
        sk: { "S.$": $.stringAt("$.sk") },
      },
      ConditionExpression: "#STATE = :pending",
      ExpressionAttributeNames: {
        "#STATE": "state",
        "#UPDATEDAT": "updated_at",
        "#ATTEMPTS": "attempts",
      },
      ExpressionAttributeValues: {
        ":pending": { S: "pending" },
        ":running": { S: "running" },
        ":now": { "S.$": $.stringAt("$$.State.EnteredTime") },
        ":one": { N: "1" },
      },
      UpdateExpression:
        "SET #STATE = :running, #UPDATEDAT = :now ADD #ATTEMPTS :one",
      ReturnValues: "ALL_NEW",
    },
    ResultPath: $.stringAt("$.job"),
  }).addCatch({
    ErrorEquals: ["DynamoDB.ConditionalCheckFailedException"],
    ResultPath: $.DISCARD,
    Next: alreadyClaimed,
  })
  const buildRequest = new Pass("Build Pairwise Request", {
    Parameters: {
      "submissionId.$": $.stringAt("$.job.Attributes.pk.S"),
      reportProgress: false,
      pairsPrepared: true,
      payload: [
        [
          {
            "pk.$": $.stringAt("$.job.Attributes.left.M.pk.S"),
            "sk.$": $.stringAt("$.job.Attributes.left.M.sk.S"),
            "media_id.$": $.stringAt("$.job.Attributes.left.M.media_id.S"),
            "detection_id.$": $.stringAt(
              "$.job.Attributes.left.M.detection_id.S"
            ),
            "bucket.$": $.stringAt("$.job.Attributes.left.M.bucket.S"),
            "key.$": $.stringAt("$.job.Attributes.left.M.key.S"),
          },
          {
            "pk.$": $.stringAt("$.job.Attributes.right.M.pk.S"),
            "sk.$": $.stringAt("$.job.Attributes.right.M.sk.S"),
            "media_id.$": $.stringAt("$.job.Attributes.right.M.media_id.S"),
            "detection_id.$": $.stringAt(
              "$.job.Attributes.right.M.detection_id.S"
            ),
            "bucket.$": $.stringAt("$.job.Attributes.right.M.bucket.S"),
            "key.$": $.stringAt("$.job.Attributes.right.M.key.S"),
          },
        ],
      ],
      search: {
        type: "pairwise",
        functionName: config.searchFunction,
        config: null,
      },
      refine: config.refinements,
      expires: null,
    },
    ResultPath: $.stringAt("$.request"),
  })
  const runPairwise = new StepFunctionInvoke(
    "Run Pairwise Search",
    similaritySearch,
    {
      Parameters: {
        "Input.$": $.jsonToString("$.request"),
      },
      ResultPath: $.stringAt("$.pairwise"),
    },
    "sync"
  )
  const setSucceeded = createTerminalState("Set Pair Job Succeeded", "succeeded")
  const setFailed = createTerminalState("Set Pair Job Failed", "failed")
  const fail = setFailed.next(new Fail("Pairwise Search Failed"))
  const finish = new Choice("Check Pairwise Search Result", {
    Choices: [
      {
        Variable: $.stringAt("$.pairwise.Status"),
        StringEquals: "SUCCEEDED",
        Next: setSucceeded,
      },
    ],
    Default: fail,
  })
  runPairwise.addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.pairwise"),
    Next: fail,
  })

  const definition = claim.next(buildRequest).next(runPairwise).next(finish)
  const stateMachine = new StateMachine(
    `${name}PairJobRunner`,
    {
      type: "EXPRESS",
      definition,
      loggingConfiguration: {
        logDestination: $util.interpolate`${logGroup.arn}:*`,
        includeExecutionData: true,
        level: "ALL",
      },
    },
    { deleteBeforeReplace: false }
  )

  new aws.iam.RolePolicy(`${name}PairJobRunnerTablePolicy`, {
    role: stateMachine.role.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["dynamodb:UpdateItem"],
          Resource: [table.arn],
        },
      ],
    },
  })

  return stateMachine

  function createTerminalState(stateName: string, state: string) {
    return new Custom(stateName, {
      Type: "Task",
      Resource: "arn:aws:states:::dynamodb:updateItem",
      Parameters: {
        TableName: table.name.apply(async (tableName) => tableName),
        Key: {
          pk: { "S.$": $.stringAt("$.pk") },
          sk: { "S.$": $.stringAt("$.sk") },
        },
        ConditionExpression: "#STATE = :running",
        ExpressionAttributeNames: {
          "#STATE": "state",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":running": { S: "running" },
          ":state": { S: state },
          ":now": { "S.$": $.stringAt("$$.State.EnteredTime") },
        },
        UpdateExpression: "SET #STATE = :state, #UPDATEDAT = :now",
      },
      ResultPath: $.DISCARD,
    })
  }
}

export function createPairJobDispatch(
  name: string,
  bus: aws.cloudwatch.EventBus,
  runner: StateMachine
) {
  const rule = new aws.cloudwatch.EventRule(`${name}PendingPairJobRule`, {
    name: physicalName(256, `${name}PendingPairJobRule`),
    eventBusName: bus.name,
    eventPattern: JSON.stringify({
      detail: {
        dynamodb: {
          NewImage: {
            item_type: { S: ["pair_job"] },
            state: { S: ["pending"] },
          },
        },
      },
    }),
  })
  const role = new aws.iam.Role(`${name}PairJobDispatchRole`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "events.amazonaws.com",
    }),
  })

  new aws.iam.RolePolicy(`${name}PairJobDispatchPolicy`, {
    role: role.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["states:StartExecution"],
          Resource: [runner.arn],
        },
      ],
    },
  })

  new aws.cloudwatch.EventTarget(`${name}PendingPairJobTarget`, {
    targetId: physicalName(256, `${name}PendingPairJobTarget`),
    eventBusName: bus.name,
    rule: rule.name,
    arn: runner.arn,
    roleArn: role.arn,
    inputTransformer: {
      inputPaths: {
        pk: "$.detail.dynamodb.NewImage.pk.S",
        sk: "$.detail.dynamodb.NewImage.sk.S",
      },
      inputTemplate: '{"pk":"<pk>","sk":"<sk>"}',
    },
  })
}
