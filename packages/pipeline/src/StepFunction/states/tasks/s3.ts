import { physicalName } from "../../sst-helpers"
import { type Chainable } from "../../state"
import { TaskStateBase, TaskStateBaseParams } from "./task-base"

type S3TaskOperations = "getObject" | "putObject"

type S3TaskParameters = {
  Bucket: $util.Input<string>
  Key: $util.Input<string>
}

type Parameters = Omit<TaskStateBaseParams<S3TaskParameters>, "Resource">

export class S3<
  T extends S3TaskOperations,
> extends TaskStateBase<S3TaskParameters> {
  private static createdPolicies: { [key: string]: boolean } = {}

  constructor(
    public name: string,
    protected operation: T,
    params: Parameters
  ) {
    super(name, {
      Resource: `arn:aws:states:::aws-sdk:s3:${operation}`,
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

    const policyName = `${prefix}S3${this.operation}SfnRolePolicy`
    if (!S3.createdPolicies[policyName]) {
      new aws.iam.RolePolicy(
        `${prefix}S3${this.operation}SfnRolePolicy`,
        {
          name: physicalName(256, `${prefix}S3${this.operation}SfnRolePolicy`),
          role: role.name,
          policy: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  `s3:${this.operation.charAt(0).toUpperCase() + this.operation.slice(1)}`,
                ],
                Resource: [`arn:aws:s3:::${this.params.Parameters.Bucket}/*`],
              },
            ],
          },
        },
        { parent: role }
      )
      S3.createdPolicies[policyName] = true
    }
  }
}
