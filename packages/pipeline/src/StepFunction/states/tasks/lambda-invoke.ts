import { physicalName } from "../../sst-helpers"
import { type Chainable } from "../../state"
import { TaskStateBase, TaskStateBaseParams } from "./task-base"

type LambdaInvokeTaskParameters = {
  FunctionName?: $util.Output<string>
  Payload?: Record<string, $util.Input<unknown>>
}

type Parameters = Omit<
  TaskStateBaseParams<LambdaInvokeTaskParameters>,
  "Resource" | "FunctionName"
>

export class LambdaInvoke extends TaskStateBase<LambdaInvokeTaskParameters> {
  constructor(
    public name: string,
    protected func: aws.lambda.Function | $util.Output<aws.lambda.Function>,
    params: Parameters
  ) {
    const { Parameters, ...rest } = params
    super(name, {
      Resource: `arn:aws:states:::lambda:invoke`,
      Parameters: {
        ...Parameters,
        FunctionName: func.name.apply(async (name) => name),
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

    $util.all([this.func.name, this.func.arn]).apply(([funcName, funcArn]) => {
      new aws.iam.RolePolicy(
        `${prefix}Invoke${funcName}SfnRolePolicy`,
        {
          name: physicalName(256, `${prefix}Invoke${funcName}SfnRolePolicy`),
          role: role.name,
          policy: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: ["lambda:InvokeFunction"],
                Resource: [funcArn],
              },
            ],
          },
        },
        { parent: role }
      )
    })
  }
}
