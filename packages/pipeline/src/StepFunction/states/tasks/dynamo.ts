import { physicalName } from "../../sst-helpers"
import { type Chainable } from "../../state"
import { TaskStateBase, TaskStateBaseParams } from "./task-base"

type DynamoTaskOperations = "getItem" | "putItem" | "updateItem" | "deleteItem"

//TODO: rest of types (blob, list, map)
// could also strongly type them to key, just need to consider .$
interface DynamoTaskOperationArguments {
  getItem: {
    Key: $util.Input<
      Record<string, Record<string, boolean | string | string[]>>
    >
  }
  putItem: {
    Item: $util.Input<
      Record<string, Record<string, boolean | string | string[]>>
    >
  }
  updateItem: $util.Input<{
    Key: Record<string, Record<string, boolean | string | string[]>>
    UpdateExpression: string
    ExpressionAttributeNames?: Record<string, string>
    ExpressionAttributeValues?: Record<
      string,
      Record<string, boolean | string | string[]>
    >
  }>
}

type DynamoTaskArguments<T extends DynamoTaskOperations> =
  T extends keyof DynamoTaskOperationArguments
    ? DynamoTaskOperationArguments[T]
    : never

type Parameters<T extends DynamoTaskOperations> = Omit<
  TaskStateBaseParams<DynamoTaskArguments<T>>,
  "Resource"
> & {
  Parameters: DynamoTaskArguments<T>
}

export class Dynamo<T extends DynamoTaskOperations> extends TaskStateBase<
  DynamoTaskArguments<T>
> {
  readonly Type = "Task"
  private static createdPolicies: { [key: string]: boolean } = {}

  constructor(
    public name: string,
    protected operation: T,
    protected table: sst.aws.Dynamo,
    params: Parameters<T>
  ) {
    const { Parameters, ...rest } = params
    super(name, {
      Resource: `arn:aws:states:::dynamodb:${operation}`,
      Parameters: {
        ...Parameters,
        TableName: table.name.apply(async (name) => name),
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

    this.table.name.apply((tableName) => {
      const policyName = `${prefix}${tableName}${this.operation}SfnRolePolicy`
      if (!Dynamo.createdPolicies[policyName]) {
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
                  Action: [
                    `dynamodb:${this.operation.charAt(0).toUpperCase() + this.operation.slice(1)}`,
                  ],
                  Resource: [
                    this.table.arn,
                    $util.interpolate`${this.table.arn}/*`,
                  ],
                },
              ],
            },
          },
          { parent: role }
        )
        Dynamo.createdPolicies[policyName] = true
      }
    })
  }
}
