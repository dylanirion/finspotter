import {
  $,
  LambdaInvoke,
  Pass,
  StateMachine,
} from "@finspotter/pipeline/StepFunction"
import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

export function createAddMachine(add: $util.Output<aws.lambda.Function>) {
  const logGroup = createLogGroup()

  const addToIndex = new LambdaInvoke("Add to Index", add, {
    Parameters: {
      Payload: {
        "id.$": $.stringAt("$.id"),
        "type.$": $.stringAt("$.type"),
        "category.$": $.stringAt("$.category"),
        "bucket.$": $.stringAt("$.bucket"),
        "key.$": $.stringAt("$.key"),
      },
    },
  })
  //TODO: addRetry

  //TODO: update frontend database to mark that this annotation has indexed features?
  const callback = new Pass("Callback")

  const definition = addToIndex.next(callback)

  return new StateMachine(
    "PgVectorAddMachine",
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
  return new aws.cloudwatch.LogGroup("PgVectorAddMachineLog", {
    name: `/aws/sfn/${physicalName(256, "PgVectorAddMachineLog")}`,
    retentionInDays: 3,
  })
}
