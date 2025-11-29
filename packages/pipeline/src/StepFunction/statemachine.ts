// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../.sst/platform/config.d.ts" />

import { physicalName, transform, type Transform } from "./sst-helpers"
import { type ChainDefinition } from "./state"

export interface StateMachineArgs
  extends Partial<Omit<aws.sfn.StateMachineArgs, "definition">> {
  definition: ChainDefinition
  transform?: {
    stateMachine?: Transform<aws.sfn.StateMachineArgs>
  }
}

const region = aws.config.requireRegion()

export class StateMachine extends $util.ComponentResource {
  static __pulumiType: string
  public readonly stateMachine: aws.sfn.StateMachine
  public readonly role: aws.iam.Role

  constructor(
    name: string,
    args: StateMachineArgs,
    opts?: $util.CustomResourceOptions
  ) {
    super(__pulumiType, name, args, opts)

    // Create IAM role for the state machine
    this.role = new aws.iam.Role(
      `${name}SfnRole`,
      {
        name: `${$app.name}-${$app.stage}-${name}`,
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: `states.${region}.amazonaws.com`,
        }),
      },
      { parent: this }
    )

    if (args.loggingConfiguration) {
      new aws.iam.RolePolicy(
        `${name}LogPolicy`,
        {
          role: this.role.name,
          policy: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  "logs:CreateLogGroup",
                  "logs:CreateLogStream",
                  "logs:PutLogEvents",
                  "logs:CreateLogDelivery",
                  "logs:GetLogDelivery",
                  "logs:UpdateLogDelivery",
                  "logs:DeleteLogDelivery",
                  "logs:ListLogDeliveries",
                  "logs:PutResourcePolicy",
                  "logs:DescribeResourcePolicies",
                  "logs:DescribeLogGroups",
                ],
                Resource: "*",
              },
            ],
          },
        },
        { parent: this.role }
      )
    }

    args.definition.createPermissions(this.role, name)
    const { definition, ...rest } = args
    this.stateMachine = new aws.sfn.StateMachine(
      ...transform(
        args.transform?.stateMachine,
        `${name}StateMachine`,
        {
          name: physicalName(256, name),
          definition: $util.jsonStringify(definition.serialize()),
          roleArn: this.role.arn,
          ...rest,
        },
        { parent: this }
      )
    )

    this.registerOutputs({
      stateMachine: this.stateMachine,
      role: this.role,
    })
  }

  /**
   * The State Machine ID.
   */
  public get id() {
    return this.stateMachine.id
  }

    /**
   * The State Machine Name.
   */
  public get name() {
    return this.stateMachine.name
  }

  /**
   * The State Machine ARN.
   */
  public get arn() {
    return this.stateMachine.arn
  }

  /** @internal */
  public getSSTLink() {
    return {
      properties: {
        id: this.stateMachine.id,
        name: this.stateMachine.name,
        arn: this.stateMachine.arn,
        roleArn: this.role.arn,
      },
      include: [
        {
          type: "aws.permission",
          actions: ["states:*"],
          resources: [
            this.stateMachine.arn,
            $util.interpolate`${this.stateMachine.arn.apply((arn) =>
              arn.replace("stateMachine", "execution")
            )}:*`,
          ],
        },
      ],
    }
  }
}

const __pulumiType = "sst:aws:StateMachine"
StateMachine.__pulumiType = __pulumiType
