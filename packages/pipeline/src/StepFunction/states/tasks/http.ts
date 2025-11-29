import { physicalName } from "../../sst-helpers"
import { type Chainable } from "../../state"
import { TaskStateBase, TaskStateBaseParams } from "./task-base"

//TODO needs to take a aws.cloudwatch.EventConnection
type HTTPTaskParameters = {
  ApiEndpoint: $util.Input<string>
  Method: "POST"
  Authentication: {
    ConnectionArn: $util.Input<string>
  }
  Headers: Record<string, $util.Input<string>>
  RequestBody: $util.Input<string>
}

type Parameters = Omit<TaskStateBaseParams<HTTPTaskParameters>, "Resource">

export class HTTP extends TaskStateBase<HTTPTaskParameters> {
  constructor(
    public name: string,
    params: Parameters
  ) {
    super(name, {
      Resource: "arn:aws:states:::http:invoke",
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

    new aws.iam.RolePolicy(
      `${prefix}HttpSfnRolePolicy`,
      {
        name: physicalName(256, `${prefix}HttpSfnRolePolicy`),
        role: role.name,
        policy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["states:InvokeHTTPEndpoint"],
              Resource: ["*"], //TODO: endpoint resource
            },
            {
              Effect: "Allow",
              Action: ["events:RetrieveConnectionCredentials"],
              Resource: ["*"], //TODO: credentials resource
            },
          ],
        },
      },
      { parent: role }
    )
  }
}
