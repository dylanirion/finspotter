import { physicalName } from "../../sst-helpers"
import { type Chainable } from "../../state"
import { TaskStateBase, TaskStateBaseParams } from "./task-base"

type EventBridgeTaskParameters = {
  Entries: ({
    DetailType: string
    //TODO: pass the bus object here instead of in eventBus so we can target multiple busses
  } & ({ Source: string } | { "Source.$": string }) &
    ({ Detail: string | object } | { "Detail.$": string | object }))[]
}

type Parameters = Omit<
  TaskStateBaseParams<EventBridgeTaskParameters>,
  "Resource"
>

export class EventBridge extends TaskStateBase<EventBridgeTaskParameters> {
  private static createdPolicies: { [key: string]: boolean } = {}

  constructor(
    public name: string,
    protected eventBus: aws.cloudwatch.EventBus,
    params: Parameters
  ) {
    const { Parameters, ...rest } = params
    super(name, {
      Resource: "arn:aws:states:::events:putEvents",
      Parameters: {
        ...Parameters,
        Entries: Parameters.Entries.map((entry) => ({
          ...entry,
          EventBusName: eventBus.name,
        })),
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

    this.eventBus.name.apply((busName) => {
      const policyName = `${prefix}${busName}SfnRolePolicy`
      if (!EventBridge.createdPolicies[policyName]) {
        new aws.iam.RolePolicy(
          policyName,
          {
            name: physicalName(256, policyName),
            role: role.name,
            policy: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: ["events:PutEvents"],
                  Resource: [this.eventBus.arn],
                },
              ],
            },
          },
          { parent: role }
        )
        EventBridge.createdPolicies[policyName] = true
      }
    })
  }
}
