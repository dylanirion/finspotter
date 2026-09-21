import {
  $,
  Choice,
  Custom,
  Dynamo,
  Fail,
  Map,
  Pass,
  StateMachine,
  StepFunctionInvoke,
} from "../StepFunction"

export function createSubmissionReviewStateMachine(
  name: string,
  table: sst.aws.Dynamo,
  mediaProcessing: StateMachine
) {
  const logGroup = new aws.cloudwatch.LogGroup(`${name}OrchestratorLog`, {
    name: `/aws/sfn/${$app.name}-${$app.stage}-${name}Orchestrator`,
    retentionInDays: 3,
  })

  const setStatusInitialised = createStatusState(
    "Set Status Initialised",
    "initialised"
  )
  const setStatusSucceeded = createStatusState(
    "Set Status Succeeded",
    "succeeded"
  )
  const setStatusFailed = createStatusState("Set Status Failed", "failed")

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

  const processingSucceeded = new Pass("Media Processing Succeeded", {
    Result: { status: "SUCCEEDED" },
    ResultPath: $.stringAt("$.processingOutcome"),
  })
  const processingFailed = new Pass("Media Processing Failed", {
    Result: { status: "FAILED" },
    ResultPath: $.stringAt("$.processingOutcome"),
  })
  const checkProcessingResult = new Choice("Check Media Processing Result", {
    Choices: [
      {
        Variable: $.stringAt("$.mediaProcessing.Status"),
        StringEquals: "SUCCEEDED",
        Next: processingSucceeded,
      },
    ],
    Default: processingFailed,
  })

  // TODO: paginate submissions whose active result frontier exceeds DynamoDB's 1 MB limit.
  const findReviewableResults = new Custom("Find Reviewable Results", {
    Type: "Task",
    Resource: "arn:aws:states:::aws-sdk:dynamodb:query",
    Parameters: {
      TableName: table.name.apply(async (tableName) => tableName),
      KeyConditionExpression: "#PK = :pk",
      FilterExpression: "#GSI1PK = :result",
      ExpressionAttributeNames: {
        "#PK": "pk",
        "#GSI1PK": "gsi1pk",
      },
      ExpressionAttributeValues: {
        ":pk": {
          "S.$": $.stringAt("$.submissionId"),
        },
        ":result": {
          S: "result",
        },
      },
      ProjectionExpression: "pk, sk",
    },
    ResultPath: $.stringAt("$.reviewable"),
  })

  const setResultFinal = new Dynamo("Set Result Final", "updateItem", table, {
    Parameters: {
      Key: {
        pk: {
          "S.$": $.stringAt("$.pk"),
        },
        sk: {
          "S.$": $.stringAt("$.sk"),
        },
      },
      ExpressionAttributeNames: {
        "#FINAL": "final",
      },
      ExpressionAttributeValues: {
        ":final": {
          BOOL: true,
        },
      },
      UpdateExpression: "SET #FINAL = :final",
    },
    ResultPath: $.DISCARD,
  })
  const markResultsReviewable = new Map("Mark Results Reviewable", {
    ItemsPath: $.stringAt("$.reviewable.Items"),
    ItemSelector: {
      "pk.$": $.stringAt("$$.Map.Item.Value.pk.S"),
      "sk.$": $.stringAt("$$.Map.Item.Value.sk.S"),
    },
    ItemProcessor: setResultFinal,
    ResultPath: $.DISCARD,
  })

  const finishFailed = setStatusFailed.next(
    new Fail("Submission Processing Failed")
  )
  const finish = new Choice("Set Final Submission Status", {
    Choices: [
      {
        Variable: $.stringAt("$.processingOutcome.status"),
        StringEquals: "SUCCEEDED",
        Next: setStatusSucceeded,
      },
    ],
    Default: finishFailed,
  })
  const finalise = findReviewableResults
    .next(markResultsReviewable)
    .next(finish)

  processingSucceeded.next(finalise)
  processingFailed.next(finalise)
  runMediaProcessing.addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.mediaProcessing"),
    Next: processingFailed,
  })

  const definition = setStatusInitialised
    .next(runMediaProcessing)
    .next(checkProcessingResult)
  const stateMachine = new StateMachine(
    `${name}Orchestrator`,
    {
      type: "EXPRESS",
      definition,
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

  new aws.iam.RolePolicy(`${name}QueryResultsSfnRolePolicy`, {
    role: stateMachine.role.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["dynamodb:Query"],
          Resource: [table.arn],
        },
      ],
    },
  })

  return stateMachine

  function createStatusState(stateName: string, status: string) {
    return new Dynamo(stateName, "updateItem", table, {
      Parameters: {
        Key: {
          pk: {
            "S.$": $.stringAt("$.submissionId"),
          },
          sk: {
            S: "status",
          },
        },
        ExpressionAttributeNames: {
          "#GSI1PK": "gsi1pk",
          "#STATUS": "status",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":gsi1pk": {
            S: "status",
          },
          ":status": {
            S: status,
          },
          ":updatedat": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    })
  }
}