import {
  $,
  Choice,
  Custom,
  Dynamo,
  Fail,
  Map,
  Pass,
  StateMachine,
} from "../StepFunction"

export function createStateMachine(name: string, table: sst.aws.Dynamo) {
  const logGroup = new aws.cloudwatch.LogGroup(`${name}Log`, {
    name: `/aws/sfn/${$app.name}-${$app.stage}-${name}`,
    retentionInDays: 3,
  })
  const pipelineFailed = new Fail("Media Processing Failed")
  const setStatusDetecting = createStatusState(
    "Set Status Detecting",
    "detecting"
  )
  const setStatusExtracting = createStatusState(
    "Set Status Extracting",
    "extracting"
  )
  const invokeDetection = new Custom("Invoke detection function", {
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
  const invokeExtraction = new Custom("Invoke feature extraction function", {
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
  const validateDetectionOutput = new Choice("Validate detection output", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$[0]"), IsPresent: false },
          { Variable: $.stringAt("$"), IsString: false },
        ],
        Next: new Pass("Empty detection output valid"),
      },
      {
        And: [
          { Variable: $.stringAt("$[0].pk"), IsPresent: true },
          { Variable: $.stringAt("$[0].sk"), IsPresent: true },
          { Variable: $.stringAt("$[0].media_id"), IsPresent: true },
          { Variable: $.stringAt("$[0].detection_id"), IsPresent: true },
          { Variable: $.stringAt("$[0].bucket"), IsPresent: true },
          { Variable: $.stringAt("$[0].key"), IsPresent: true },
        ],
        Next: new Pass("Detection output valid"),
      },
    ],
    Default: new Fail("Invalid detection output"),
  })
  const validateExtractionOutput = new Choice("Validate extraction output", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$.pk"), IsPresent: true },
          { Variable: $.stringAt("$.sk"), IsPresent: true },
          { Variable: $.stringAt("$.media_id"), IsPresent: true },
          { Variable: $.stringAt("$.detection_id"), IsPresent: true },
          { Variable: $.stringAt("$.bucket"), IsPresent: true },
          { Variable: $.stringAt("$.key"), IsPresent: true },
        ],
        Next: new Pass("Extraction output valid"),
      },
    ],
    Default: new Fail("Invalid extraction output"),
  })
  const detectionProcessor = invokeDetection.next(validateDetectionOutput)
  const extractionProcessor = invokeExtraction.next(validateExtractionOutput)
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
    ItemProcessor: detectionProcessor,
  }).addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.error"),
    Next: pipelineFailed,
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
    ResultPath: $.stringAt("$.payload"),
    ItemProcessor: extractionProcessor,
  }).addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.error"),
    Next: pipelineFailed,
  })
  const detectionChoice = new Choice("Do detection?", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$.payload[0]"), IsPresent: true },
          {
            Variable: $.stringAt("$.detect.functionName"),
            IsPresent: true,
          },
        ],
        Next: createProgressChoice(
          "Report detection progress?",
          setStatusDetecting,
          iterateImages
        ),
      },
    ],
    Default: new Pass("No detection"),
  })
  const extractionChoice = new Choice("Do extraction?", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$.payload[0]"), IsPresent: true },
          {
            Variable: $.stringAt("$.extract.functionName"),
            IsPresent: true,
          },
        ],
        Next: createProgressChoice(
          "Report extraction progress?",
          setStatusExtracting,
          iterateDetections
        ),
      },
    ],
    Default: new Pass("No extraction"),
  })

  return new StateMachine(
    name,
    {
      type: "EXPRESS",
      definition: detectionChoice
        .next(extractionChoice)
        .next(new Pass("Media Processing Complete")),
      loggingConfiguration: {
        logDestination: $util.interpolate`${logGroup.arn}:*`,
        includeExecutionData: true,
        level: "ALL",
      },
    },
    { deleteBeforeReplace: false }
  )

  function createStatusState(stateName: string, status: string) {
    return new Dynamo(stateName, "updateItem", table, {
      Parameters: {
        Key: {
          pk: { "S.$": $.stringAt("$.submissionId") },
          sk: { S: "status" },
        },
        ExpressionAttributeNames: {
          "#GSI1PK": "gsi1pk",
          "#STATUS": "status",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":gsi1pk": { S: "status" },
          ":status": { S: status },
          ":updatedat": { "S.$": $.stringAt("$$.State.EnteredTime") },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    })
  }

  function createProgressChoice(
    choiceName: string,
    statusState: Dynamo<"updateItem">,
    work: Map
  ) {
    return new Choice(choiceName, {
      Choices: [
        {
          Variable: $.stringAt("$.reportProgress"),
          BooleanEquals: false,
          Next: work,
        },
      ],
      Default: statusState.next(work),
    })
  }
}
