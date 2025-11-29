import {
  $,
  Choice,
  Dynamo,
  Pass,
  StateMachine,
  StepFunctionInvoke,
} from "@finspotter/pipeline/StepFunction"
import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

export function createAutoAddMachine(
  table: sst.aws.Dynamo,
  addMachine: StateMachine
) {
  const logGroup = createLogGroup()

  const checkAutoReview = new Dynamo(
    "Check for Auto-Review Attribute",
    "getItem",
    table,
    {
      Parameters: {
        Key: {
          pk: {
            "S.$": $.stringAt("$.pk"),
          },
          sk: {
            S: "status",
          },
        },
      },
      ResultPath: $.stringAt("$.status"),
    }
  )

  const invokeAddMachine = new StepFunctionInvoke(
    "Invoke Add Machine",
    addMachine,
    {
      Parameters: {
        Input: {
          "id.$": $.stringAt("$.type"),
          "type.$": $.stringAt("$.type"),
          "category.$": $.stringAt("$.category"),
          "bucket.$": $.stringAt("$.bucket"),
          "key.$": $.stringAt("$.key"),
        },
      },
    }
  )

  const doNotAddToIndex = new Pass("Do Not Add to Index")

  const addOrPass = new Choice("Add to Index or Pass", {
    Choices: [
      {
        Variable: $.stringAt("$.status.Item.auto_review.BOOL"),
        IsPresent: true,
        Next: invokeAddMachine,
      },
    ],
    Default: doNotAddToIndex,
  })

  const definition = checkAutoReview.next(addOrPass)

  return new StateMachine(
    "PgVectorAutoAdd",
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

function createLogGroup() {
  return new aws.cloudwatch.LogGroup("PgVectorAutoAddLog", {
    name: `/aws/sfn/${physicalName(256, "PgVectorAutoAddLog")}`,
    retentionInDays: 3,
  })
}
