import {
  $,
  Pass,
  StateMachine,
  StepFunctionInvoke,
} from "@finspotter/pipeline/StepFunction"
import { physicalName } from "@finspotter/pipeline/StepFunction/sst-helpers"

export function createAutoAddMachine(addMachine: StateMachine) {
  const logGroup = createLogGroup()

  const invokeAddMachine = new StepFunctionInvoke(
    "Invoke Add Machine",
    addMachine,
    {
      Parameters: {
        Input: {
          "id.$": $.stringAt("$.id"),
          "type.$": $.stringAt("$.type"),
          "category.$": $.stringAt("$.category"),
          "bucket.$": $.stringAt("$.bucket"),
          "key.$": $.stringAt("$.key"),
        },
      },
    }
  )
  const definition = invokeAddMachine.next(new Pass("Index Added"))

  return new StateMachine(
    "PgVectorAutoAdd",
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
}

function createLogGroup() {
  return new aws.cloudwatch.LogGroup("PgVectorAutoAddLog", {
    name: `/aws/sfn/${physicalName(256, "PgVectorAutoAddLog")}`,
    retentionInDays: 3,
  })
}
