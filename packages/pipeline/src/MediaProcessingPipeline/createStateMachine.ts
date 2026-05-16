import { buildSet } from "../buildSet"
import {
  $,
  Choice,
  Custom,
  Dynamo,
  Fail,
  LambdaInvoke,
  Map,
  Pass,
  StateMachine,
} from "../StepFunction"

export function createStateMachine(name: string, table: sst.aws.Dynamo) {
  const logGroup = createLogGroup(name)

  const setStatusInitialised = new Dynamo(
    "Set Status Initialised",
    "updateItem",
    table,
    {
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
            S: "initialised",
          },
          ":updatedat": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    }
  )

  const setStatusDetecting = new Dynamo(
    "Set Status Detecting",
    "updateItem",
    table,
    {
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
            S: "detecting",
          },
          ":updatedat": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    }
  )

  const setStatusExtracting = new Dynamo(
    "Set Status Extracting",
    "updateItem",
    table,
    {
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
            S: "extracting",
          },
          ":updatedat": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    }
  )

  const setStatusSearching = new Dynamo(
    "Set Status Searching",
    "updateItem",
    table,
    {
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
            "S.$": $.format(`searching ({})`, "$.search.type"),
          },
          ":updatedat": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    }
  )

  const setStatusSucceeded = new Dynamo(
    "Set Status Succeeded",
    "updateItem",
    table,
    {
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
            S: "succeeded",
          },
          ":updatedat": {
            "S.$": $.stringAt("$$.State.EnteredTime"),
          },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    }
  )

  const setStatusFailed = new Dynamo("Set Status Failed", "updateItem", table, {
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
          S: "failed",
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

  const setResultFinal = new Dynamo("Set Final", "updateItem", table, {
    Parameters: {
      Key: {
        pk: {
          "S.$": $.stringAt("$.payload.pk"),
        },
        sk: {
          "S.$": $.stringAt("$.payload.sk"),
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

  //TODO: handle failed steps in Map states gracefully, some are not catastrophic
  const iterateResults = new Map("Iterate results", {
    ItemsPath: $.stringAt("$.payload"),
    ItemSelector: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$$.Map.Item.Value"),
      "expires.$": $.stringAt("$.expires"),
    },
    ResultPath: $.DISCARD,
    ItemProcessor: setResultFinal,
  })

  const invokeAnyDetectionFunction = new Custom("Invoke detection function", {
    Type: "Task",
    Resource: "arn:aws:states:::lambda:invoke",
    Parameters: {
      Payload: {
        "submissionId.$": $.stringAt("$.submissionId"),
        "payload.$": $.stringAt("$.payload"),
        "config.$": $.stringAt("$.config"),
        "expires.$": $.stringAt("$.expires"),
      },
      "FunctionName.$": $.stringAt("$.functionName"),
    },
    ResultPath: $.stringAt("$"),
    OutputPath: $.stringAt("$.Payload"),
  }).addRetry({
    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
    IntervalSeconds: 2,
    MaxAttempts: 6,
    BackoffRate: 2,
  })

  const invokeAnyExtractionFunction = new Custom(
    "Invoke feature extraction function",
    {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        Payload: {
          "submissionId.$": $.stringAt("$.submissionId"),
          "payload.$": $.stringAt("$.payload"),
          "config.$": $.stringAt("$.config"),
          "expires.$": $.stringAt("$.expires"),
        },
        "FunctionName.$": $.stringAt("$.functionName"),
      },
      ResultPath: $.stringAt("$"),
      OutputPath: $.stringAt("$.Payload"),
    }
  ).addRetry({
    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
    IntervalSeconds: 2,
    MaxAttempts: 6,
    BackoffRate: 2,
  })

  const invokeAnySearchFunction = new Custom(
    "Invoke similarity search function",
    {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        Payload: {
          "submissionId.$": $.stringAt("$.submissionId"),
          "payload.$": $.stringAt("$.payload"),
          "config.$": $.stringAt("$.config"),
          "expires.$": $.stringAt("$.expires"),
        },
        "FunctionName.$": $.stringAt("$.functionName"),
      },
      ResultSelector: {
        "merged.$": $.jsonMerge(
          "$$.Execution.Input",
          $.stringToJson(
            // eslint-disable-next-line no-useless-escape
            $.format('\\{\"payload\": {}\\}', $.jsonToString("$.Payload"))
          )
        ),
      },
      OutputPath: $.stringAt("$.merged"),
    }
  ).addRetry({
    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
    IntervalSeconds: 2,
    MaxAttempts: 6,
    BackoffRate: 2,
  })

  const invokeAnyMatchRefinementFunction = new Custom(
    "Invoke match refinement function",
    {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        Payload: {
          "submissionId.$": $.stringAt("$.submissionId"),
          "index.$": $.stringAt("$.refineFunctionIndex"),
          "payload.$": $.stringAt("$.payload"),
          "config.$": $.stringAt("$.function.config"),
          "expires.$": $.stringAt("$.expires"),
        },
        "FunctionName.$": $.stringAt("$.function.functionName"),
      },
      ResultPath: $.stringAt("$.payload"),
    }
  ).addRetry({
    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
    IntervalSeconds: 2,
    MaxAttempts: 6,
    BackoffRate: 2,
  })

  const iterateImages = new Map("Iterate images", {
    ItemsPath: $.stringAt("$.payload"),
    ItemSelector: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$$.Map.Item.Value"),
      "functionName.$": $.stringAt("$.detect.functionName"),
      "config.$": $.stringAt("$.detect.config"),
      "expires.$": $.stringAt("$.expires"),
    },
    ResultSelector: {
      "merged.$": $.jsonMerge(
        "$$.Execution.Input",
        $.stringToJson(
          // eslint-disable-next-line no-useless-escape
          $.format('\\{\"payload\": {}\\}', $.jsonToString("$[*][*]"))
        )
      ),
    },
    OutputPath: $.stringAt("$.merged"),
    ItemProcessor: invokeAnyDetectionFunction,
  }).addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.error"),
    Next: iterateResults,
  })

  const iterateDetections = new Map("Iterate detections", {
    ItemsPath: $.stringAt("$.payload"),
    ItemSelector: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$$.Map.Item.Value"),
      "functionName.$": $.stringAt("$.extract.functionName"),
      "config.$": $.stringAt("$.extract.config"),
      "expires.$": $.stringAt("$.expires"),
    },
    ResultPath: "$.payload",
    ItemProcessor: invokeAnyExtractionFunction,
  }).addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.error"),
    Next: iterateResults,
  })

  const buildPairwiseSet = new LambdaInvoke("Build Pairwise Set", buildSet, {
    Parameters: {
      Payload: {
        "payload.$": $.stringAt("$.payload"),
      },
    },
    ResultSelector: {
      "merged.$": $.jsonMerge(
        "$$.Execution.Input",
        $.stringToJson(
          // eslint-disable-next-line no-useless-escape
          $.format('\\{\"payload\": {}\\}', $.stringAt("$.Payload"))
        )
      ),
    },
    OutputPath: $.stringAt("$.merged"),
  })

  const initRefinementLoop = new Pass("Initialise match refinement loop", {
    Parameters: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$.payload"),
      refineFunctionIndex: 0,
      "numRefineFunctions.$": $.arrayLength("$.refine"),
      "expires.$": $.stringAt("$.expires"),
    },
  })

  const pullFunction = new Pass("Pull refinement function", {
    Parameters: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$.payload"),
      "refineFunctionIndex.$": $.stringAt("$.refineFunctionIndex"),
      "numRefineFunctions.$": $.stringAt("$.numRefineFunctions"),
      "function.$": `${$.arrayGetItem(
        "$$.Execution.Input.refine",
        "$.refineFunctionIndex"
      )}`,
      "expires.$": $.stringAt("$.expires"),
    },
  })

  const incrementIndex = new Pass("Increment index", {
    Parameters: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$.payload.Payload"),
      "refineFunctionIndex.$": $.mathAdd("$.refineFunctionIndex", 1),
      "numRefineFunctions.$": $.stringAt("$.numRefineFunctions"),
      "expires.$": $.stringAt("$.expires"),
    },
  })

  const continueRefining = new Choice("Continue Refining?", {
    Choices: [
      {
        Variable: $.stringAt("$.refineFunctionIndex"),
        NumericLessThanPath: $.stringAt("$.numRefineFunctions"),
        Next: pullFunction.next(invokeAnyMatchRefinementFunction),
      },
    ],
    Default: new Pass("No further refinement"), //TODO: this will go to clustering
  })

  const refinementLoop = initRefinementLoop
    .next(pullFunction)
    .next(invokeAnyMatchRefinementFunction)
  invokeAnyMatchRefinementFunction.next(incrementIndex).next(continueRefining)

  const refinementChoice = new Choice("Do match refinement?", {
    Choices: [
      {
        And: [
          {
            Variable: $.stringAt("$.payload"),
            IsPresent: true,
          },
          {
            Variable: $.stringAt("$.refine[0]"),
            IsPresent: true,
          },
        ],
        Next: refinementLoop,
      },
    ],
    Default: new Pass("No match refinement"),
  })

  const iterateFeatureSets = new Map("Iterate feature sets", {
    ItemsPath: $.stringAt("$.payload"),
    ItemSelector: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$$.Map.Item.Value"),
      "functionName.$": $.stringAt("$.search.functionName"),
      "config.$": $.stringAt("$.search.config"),
      "expires.$": $.stringAt("$.expires"),
    },
    //TODO: output is array for pairwise, single for indexed?
    ResultSelector: {
      "merged.$": $.jsonMerge(
        "$$.Execution.Input",
        $.stringToJson(
          // eslint-disable-next-line no-useless-escape
          $.format('\\{\"payload\": {}\\}', $.jsonToString("$[*].payload"))
        )
      ),
    },
    OutputPath: $.stringAt("$.merged"),
    ItemProcessor: invokeAnySearchFunction.next(refinementChoice),
  }).addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.error"),
    Next: iterateResults,
  })

  const resultChoice = new Choice("Failed or Succeeded?", {
    Choices: [
      {
        Variable: $.stringAt("$.error"),
        IsPresent: true,

        Next: setStatusFailed.next(new Fail("Failed")),
      },
    ],
    Default: setStatusSucceeded,
  })

  const detectionChoice = new Choice("Do detection?", {
    Choices: [
      {
        And: [
          {
            Variable: $.stringAt("$.payload[0]"),
            IsPresent: true,
          },
          {
            Variable: $.stringAt("$.detect.functionName"),
            IsPresent: true,
          },
        ],
        Next: setStatusDetecting.next(iterateImages),
      },
    ],
    Default: new Pass("No detection"),
  })

  const extractionChoice = new Choice("Do extraction?", {
    Choices: [
      {
        And: [
          {
            Variable: $.stringAt("$.payload[0]"),
            IsPresent: true,
          },
          {
            Variable: $.stringAt("$.extract.functionName"),
            IsPresent: true,
          },
        ],
        Next: setStatusExtracting.next(iterateDetections),
      },
    ],
    Default: new Pass("No extraction"),
  })

  const searchChoice = new Choice("Do Search (Pairwise or Indexed)?", {
    Choices: [
      {
        And: [
          {
            Variable: $.stringAt("$.payload[1]"), // ensure array is atleast two items
            IsPresent: true,
          },
          {
            Variable: $.stringAt("$.search"),
            IsPresent: true,
          },
          {
            Variable: $.stringAt("$.search.type"),
            StringEquals: "pairwise",
          },
          {
            Variable: $.stringAt("$.search.functionName"),
            IsPresent: true,
          },
        ],
        Next: buildPairwiseSet
          .next(setStatusSearching)
          .next(iterateFeatureSets),
      },
      {
        And: [
          {
            Variable: $.stringAt("$.payload[0]"),
            IsPresent: true,
          },
          {
            Variable: $.stringAt("$.search"),
            IsPresent: true,
          },
          {
            Variable: $.stringAt("$.search.type"),
            StringEquals: "indexed",
          },
          {
            Variable: $.stringAt("$.search.functionName"),
            IsPresent: true,
          },
        ],
        Next: setStatusSearching.next(iterateFeatureSets),
      },
    ],
    Default: new Pass("No search"),
  })

  const definition = setStatusInitialised
    .next(detectionChoice)
    .next(extractionChoice) //in this position extraction depends on completion of all detections but means only a single status update is sent
    .next(searchChoice)
    .next(iterateResults)
    .next(resultChoice)

  return new StateMachine(
    name,
    {
      type: "EXPRESS",
      definition: definition,
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
}

function createLogGroup(name: string) {
  return new aws.cloudwatch.LogGroup(`${name}Log`, {
    name: `/aws/sfn/${$app.name}-${$app.stage}-${name}`,
    retentionInDays: 3,
  })
}
