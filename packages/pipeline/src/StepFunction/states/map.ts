import {
  resolveChainDefinition,
  Retryable,
  StateBase,
  type Chainable,
  type ChainDefinition,
  type StateBaseParams,
} from "../state"

export interface MapStateParams extends StateBaseParams {
  ItemsPath?: $util.Input<string>
  ItemSelector?: $util.Input<object>
  MaxConcurrency?: $util.Input<number>
  MaxConcurrencyPath?: $util.Input<string>
  ItemProcessor: Chainable | ChainDefinition
}

export class Map extends StateBase implements Retryable {
  readonly Type = "Map"
  private _itemProcessor: ChainDefinition

  constructor(
    public name: string,
    protected params: MapStateParams
  ) {
    super(name, params)
    this._itemProcessor = resolveChainDefinition(params.ItemProcessor)
  }

  //TODO: need to pass parent ChainDefinition visted Set to serialize() to prevent duplicated states
  override toJSON() {
    return {
      ...super.toJSON(),
      ItemsPath: this.params.ItemsPath,
      ItemProcessor: {
        //TODO: move to MapStateParams
        //ProcessorConfig: { Mode: "DISTRIBUTED", ExecutionType: "EXPRESS" },
        ProcessorConfig: { Mode: "INLINE"},
        ...this._itemProcessor.serialize(),
      },
    }
  }

  override createPermissions(
    role: aws.iam.Role,
    prefix: string,
    visited: Set<Chainable>
  ) {
    super.createPermissions(role, prefix, visited)
    //const region = aws.getRegionOutput().name
    //const accountId = aws.getCallerIdentityOutput({}).accountId

    //TODO: condition on ProcessorConfig.Mode, Distributed Map state requires StartExecution policy
    /*
    new aws.iam.RolePolicy(
      `${prefix}-${capitalizeAndRemoveSpaces(this.name)}-MapStartExecutionPolicy`,
      {
        role: role.id,
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: "states:StartExecution",
              // TODO: narrow this to finspotter-dylan-MediaProcessingPipeline
              Resource: [
                //$util.interpolate`arn:aws:states:${region}:${accountId}:stateMachine:*`,
                "arn:aws:states:*:*:stateMachine:*",
              ],
            },
          ],
        }),
      }
    )
    */

    // Traverse into the ItemProcessor sub-workflow
    if (this._itemProcessor) {
      this._itemProcessor.startState.createPermissions(role, prefix, visited)
    }
  }
}

function capitalizeAndRemoveSpaces(str: string) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}
