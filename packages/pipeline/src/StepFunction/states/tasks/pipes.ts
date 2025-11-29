import { physicalName } from "../../sst-helpers"
import { type Chainable } from "../../state"
import { TaskStateBase, type TaskStateBaseParams } from "./task-base"

type PipesOperations = "startPipe" | "stopPipe"

type PipesParameters = {
  Name: $util.Input<string>
}

type Parameters = Omit<
  TaskStateBaseParams<PipesParameters>,
  "Resource" | "Parameters"
>

export class Pipes<
  T extends PipesOperations,
> extends TaskStateBase<PipesParameters> {
  private static createdPolicies: { [key: string]: boolean } = {}

  constructor(
    public name: string,
    protected operation: T,
    protected pipe: aws.pipes.Pipe,
    params: Parameters
  ) {
    super(name, {
      Resource: `arn:aws:states:::aws-sdk:pipes:${operation}`,
      Parameters: {
        Name: pipe.name,
      },
      ...params,
    })
  }

  override createPermissions(
    role: aws.iam.Role,
    prefix: string,
    visited: Set<Chainable>
  ) {
    if (visited.has(this)) return
    super.createPermissions(role, prefix, visited)

    const policyName = `${prefix}Pipes${this.operation}SfnRolePolicy`
    if (!Pipes.createdPolicies[policyName]) {
      new aws.iam.RolePolicy(
        `${prefix}Pipes${this.operation}SfnRolePolicy`,
        {
          name: physicalName(
            256,
            `${prefix}Pipes${this.operation}SfnRolePolicy`
          ),
          role: role.name,
          policy: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  `pipes:${this.operation.charAt(0).toUpperCase() + this.operation.slice(1)}`,
                ],
                Resource: [this.pipe.arn],
              },
            ],
          },
        },
        { parent: role }
      )
      Pipes.createdPolicies[policyName] = true
    }
  }
}
