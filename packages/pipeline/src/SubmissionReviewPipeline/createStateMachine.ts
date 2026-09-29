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
  const setLifecycleProcessing = createLifecycleState(
    "Set Lifecycle Processing",
    "processing"
  )
  const setLifecycleReviewable = createLifecycleState(
    "Set Lifecycle Reviewable",
    "reviewable"
  )

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

  const initialiseReconciliation = new Pass("Initialise Reconciliation", {
    Result: { attempt: 0 },
    ResultPath: $.stringAt("$.reconciliation"),
  })
  const findIncompleteMedia = new Custom("Find Incomplete Media", {
    Type: "Task",
    Resource: "arn:aws:states:::aws-sdk:dynamodb:query",
    Parameters: {
      TableName: table.name.apply(async (tableName) => tableName),
      KeyConditionExpression: "#PK = :pk",
      FilterExpression:
        "#ITEMTYPE = :media AND #ACCEPTED = :accepted AND (#PROCESSINGSTATUS = :pending OR #PROCESSINGSTATUS = :running)",
      ExpressionAttributeNames: {
        "#PK": "pk",
        "#ITEMTYPE": "item_type",
        "#ACCEPTED": "accepted",
        "#PROCESSINGSTATUS": "processing_status",
      },
      ExpressionAttributeValues: {
        ":pk": {
          "S.$": $.stringAt("$.submissionId"),
        },
        ":media": {
          S: "media",
        },
        ":accepted": {
          Bool: true,
        },
        ":pending": {
          S: "pending",
        },
        ":running": {
          S: "running",
        },
      },
      Select: "COUNT",
    },
    ResultPath: $.stringAt("$.incompleteMedia"),
  })
  const waitForMedia = new Custom("Wait For Media Processing", {
    Type: "Wait",
    Seconds: 5,
  })
  const incrementReconciliation = new Pass("Increment Reconciliation", {
    Parameters: {
      "attempt.$": $.mathAdd("$.reconciliation.attempt", 1),
    },
    ResultPath: $.stringAt("$.reconciliation"),
  })
  const findExtractions = new Custom("Find Accumulated Extractions", {
    Type: "Task",
    Resource: "arn:aws:states:::aws-sdk:dynamodb:query",
    Parameters: {
      TableName: table.name.apply(async (tableName) => tableName),
      KeyConditionExpression: "#PK = :pk AND begins_with(#SK, :extraction)",
      FilterExpression: "#GSI1PK = :result",
      ExpressionAttributeNames: {
        "#PK": "pk",
        "#SK": "sk",
        "#GSI1PK": "gsi1pk",
        "#FEATURES": "features",
        "#BUCKET": "bucket",
        "#KEY": "key",
      },
      ExpressionAttributeValues: {
        ":pk": {
          "S.$": $.stringAt("$.submissionId"),
        },
        ":extraction": {
          S: "extraction#",
        },
        ":result": {
          S: "result",
        },
      },
      ProjectionExpression:
        "pk, sk, media_id, detection_id, uri.#FEATURES.#BUCKET, uri.#FEATURES.#KEY",
    },
    ResultPath: $.stringAt("$.extractions"),
  })
  // TODO: paginate accumulated extractions beyond DynamoDB's 1 MB query limit.
  const buildSearchPayload = new Map("Build Search Payload", {
    ItemsPath: $.stringAt("$.extractions.Items"),
    ItemSelector: {
      "pk.$": $.stringAt("$$.Map.Item.Value.pk.S"),
      "sk.$": $.stringAt("$$.Map.Item.Value.sk.S"),
      "media_id.$": $.stringAt("$$.Map.Item.Value.media_id.S"),
      "detection_id.$": $.stringAt("$$.Map.Item.Value.detection_id.S"),
      "bucket.$": $.stringAt(
        "$$.Map.Item.Value.uri.M.features.M.bucket.S"
      ),
      "key.$": $.stringAt("$$.Map.Item.Value.uri.M.features.M.key.S"),
    },
    ItemProcessor: new Pass("Use Extraction"),
    ResultPath: $.stringAt("$.payload"),
  })

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

  const checkIncompleteMedia = new Choice("Check Incomplete Media", {
    Choices: [
      {
        Variable: $.stringAt("$.incompleteMedia.Count"),
        NumericEquals: 0,
        Next: findExtractions.next(buildSearchPayload).next(runMediaProcessing),
      },
      {
        Variable: $.stringAt("$.reconciliation.attempt"),
        NumericLessThan: 59,
        Next: waitForMedia,
      },
    ],
    Default: processingFailed,
  })
  waitForMedia
    .next(incrementReconciliation)
    .next(findIncompleteMedia)
    .next(checkIncompleteMedia)
  const reconcileOrRun = new Choice("Reconcile Accumulated Processing?", {
    Choices: [
      {
        Variable: $.stringAt("$.reconcileProcessing"),
        BooleanEquals: true,
        Next: initialiseReconciliation
          .next(findIncompleteMedia)
          .next(checkIncompleteMedia),
      },
    ],
    Default: runMediaProcessing,
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
    .next(setLifecycleReviewable)
    .next(finish)

  processingSucceeded.next(finalise)
  processingFailed.next(finalise)
  runMediaProcessing.addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.mediaProcessing"),
    Next: processingFailed,
  })

  const definition = setStatusInitialised
    .next(setLifecycleProcessing)
    .next(reconcileOrRun)
  runMediaProcessing.next(checkProcessingResult)
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

  function createLifecycleState(stateName: string, state: string) {
    return new Dynamo(stateName, "updateItem", table, {
      Parameters: {
        Key: {
          pk: {
            "S.$": $.stringAt("$.submissionId"),
          },
          sk: {
            S: "submission",
          },
        },
        ExpressionAttributeNames: {
          "#STATE": "state",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":state": {
            S: state,
          },
          ":updatedat": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression: "SET #STATE = :state, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    })
  }
}