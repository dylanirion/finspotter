import { physicalName } from "../../sst-helpers"
import { type Chainable } from "../../state"
import { StateMachine } from "../../statemachine"
import { TaskStateBase, TaskStateBaseParams } from "./task-base"

type StepFunctionInvokeTaskParameters = {
  StateMachineArn?: $util.Output<string>
  Input?: Record<string, $util.Input<unknown>>
}

type Parameters = Omit<
  TaskStateBaseParams<StepFunctionInvokeTaskParameters>,
  "Resource" | "StateMachineArn"
>

export class StepFunctionInvoke extends TaskStateBase<StepFunctionInvokeTaskParameters> {
  constructor(
    public name: string,
    protected sfn: StateMachine,
    params: Parameters
  ) {
    const { Parameters, ...rest } = params
    super(name, {
      Resource: `arn:aws:states:::states:startExecution`,
      Parameters: {
        ...Parameters,
        StateMachineArn: sfn.arn.apply(async (arn) => arn),
      },
      ...rest,
    })
  }

  override createPermissions(
    role: aws.iam.Role,
    prefix: string,
    visited: Set<Chainable>
  ) {
    if (visited.has(this)) return
    super.createPermissions(role, prefix, visited)

    $util.all([this.sfn.name, this.sfn.arn]).apply(([name, arn]) => {
      new aws.iam.RolePolicy(
        `${prefix}Invoke${name}SfnRolePolicy`,
        {
          name: physicalName(256, `${prefix}Invoke${name}SfnRolePolicy`),
          role: role.name,
          policy: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: ["states:StartExecution"],
                Resource: [arn],
              },
            ],
          },
        },
        { parent: role }
      )
    })
  }
}
