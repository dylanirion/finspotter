import {
  $,
  Choice,
  Dynamo,
  Fail,
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
  const fail = setProcessingFailed.next(new Fail("Media Processing Failed"))
  const finish = new Choice("Set Media Processing Status", {
    Choices: [
      {
        Variable: $.stringAt("$.mediaProcessing.Status"),
        StringEquals: "SUCCEEDED",
        Next: setProcessingSucceeded,
      },
    ],
    Default: fail,
  })

  runMediaProcessing.addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.mediaProcessing"),
    Next: fail,
  })

  return new StateMachine(
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
