import {
  $,
  Choice,
  Custom,
  Dynamo,
  Fail,
  Map,
  StateMachine,
  StepFunctionInvoke,
} from "../StepFunction"

export function createMediaProcessingJobStateMachine(
  name: string,
  table: sst.aws.Dynamo,
  mediaProcessing: StateMachine
) {
  const logGroup = new aws.cloudwatch.LogGroup(`${name}MediaProcessingJobLog`, {
    name: `/aws/sfn/${$app.name}-${$app.stage}-${name}MediaProcessingJob`,
    retentionInDays: 3,
  })

  const runMediaProcessing = new StepFunctionInvoke(
    "Run Media Processing",
    mediaProcessing,
    {
      Parameters: {
        "Input.$": $.jsonToString("$"),
      },
      ResultPath: $.stringAt("$.mediaProcessing"),
    },
    "sync"
  )
  const setProcessingSucceeded = createProcessingStatusState(
    "Set Media Processing Succeeded",
    "succeeded"
  )
  const setProcessingFailed = createProcessingStatusState(
    "Set Media Processing Failed",
    "failed"
  )
  const fail = new Fail("Media Processing Failed")
  const findPartialResults = new Custom("Find Partial Media Results", {
    Type: "Task",
    Resource: "arn:aws:states:::aws-sdk:dynamodb:query",
    Parameters: {
      TableName: table.name.apply(async (tableName) => tableName),
      KeyConditionExpression: "#PK = :pk",
      FilterExpression: "#GSI1PK = :result AND #MEDIAID = :mediaId",
      ExpressionAttributeNames: {
        "#PK": "pk",
        "#GSI1PK": "gsi1pk",
        "#MEDIAID": "media_id",
      },
      ExpressionAttributeValues: {
        ":pk": { "S.$": $.stringAt("$.payload[0].pk") },
        ":result": { S: "result" },
        ":mediaId": { "S.$": $.stringAt("$.payload[0].media_id") },
      },
      ProjectionExpression: "pk, sk",
    },
    ResultPath: $.stringAt("$.partialResults"),
  })
  const markPartialResultReady = new Dynamo(
    "Mark Partial Result Ready",
    "updateItem",
    table,
    {
      Parameters: {
        Key: {
          pk: { "S.$": $.stringAt("$.pk") },
          sk: { "S.$": $.stringAt("$.sk") },
        },
        ExpressionAttributeNames: {
          "#FINAL": "final",
          "#REVIEWSTATUS": "review_status",
          "#REVIEWREADYAT": "review_ready_at",
        },
        ExpressionAttributeValues: {
          ":final": { BOOL: true },
          ":reviewStatus": { S: "ready" },
          ":reviewReadyAt": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #FINAL = :final, #REVIEWSTATUS = :reviewStatus, #REVIEWREADYAT = :reviewReadyAt",
      },
      ResultPath: $.DISCARD,
    }
  )
  const markPartialResultsReady = new Map("Mark Partial Results Ready", {
    ItemsPath: $.stringAt("$.partialResults.Items"),
    ItemSelector: {
      "pk.$": $.stringAt("$$.Map.Item.Value.pk.S"),
      "sk.$": $.stringAt("$$.Map.Item.Value.sk.S"),
    },
    ItemProcessor: markPartialResultReady,
    ResultPath: $.DISCARD,
  })
  const failWithPartialResults = findPartialResults
    .next(markPartialResultsReady)
    .next(setProcessingFailed)
    .next(fail)
  findPartialResults.addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.partialResultError"),
    Next: setProcessingFailed,
  })
  markPartialResultsReady.addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.partialResultError"),
    Next: setProcessingFailed,
  })
  setProcessingFailed.next(fail)
  const finish = new Choice("Set Media Processing Status", {
    Choices: [
      {
        Variable: $.stringAt("$.mediaProcessing.Status"),
        StringEquals: "SUCCEEDED",
        Next: setProcessingSucceeded,
      },
    ],
    Default: failWithPartialResults,
  })

  runMediaProcessing.addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.mediaProcessing"),
    Next: failWithPartialResults,
  })

  const stateMachine = new StateMachine(
    `${name}MediaProcessingJob`,
    {
      type: "EXPRESS",
      definition: runMediaProcessing.next(finish),
      loggingConfiguration: {
        logDestination: $util.interpolate`${logGroup.arn}:*`,
        includeExecutionData: true,
        level: "ALL",
      },
    },
    {
      deleteBeforeReplace: false,
    }
  )

  new aws.iam.RolePolicy(`${name}MediaProcessingJobQueryPolicy`, {
    role: stateMachine.role.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: "dynamodb:Query",
          Resource: table.arn,
        },
      ],
    },
  })

  return stateMachine

  function createProcessingStatusState(stateName: string, status: string) {
    return new Dynamo(stateName, "updateItem", table, {
      Parameters: {
        Key: {
          pk: {
            "S.$": $.stringAt("$.payload[0].pk"),
          },
          sk: {
            "S.$": $.stringAt("$.payload[0].sk"),
          },
        },
        ExpressionAttributeNames: {
          "#PROCESSINGSTATUS": "processing_status",
          "#PROCESSINGCOMPLETEDAT": "processing_completed_at",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":status": {
            S: status,
          },
          ":now": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #PROCESSINGSTATUS = :status, #PROCESSINGCOMPLETEDAT = :now, #UPDATEDAT = :now",
      },
      ResultPath: $.DISCARD,
    })
  }
}
