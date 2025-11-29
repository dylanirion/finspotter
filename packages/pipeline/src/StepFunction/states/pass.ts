import { StateBase, StateBaseParams } from "../state"

export interface PassParams extends StateBaseParams {
  Result?: $util.Input<Record<string, unknown>>
  Parameters?: $util.Input<Record<string, unknown>>
  Assign?: $util.Input<Record<string, unknown>>
}

export class Pass extends StateBase {
  readonly Type = "Pass"
  constructor(
    name: string,
    protected params: PassParams = {}
  ) {
    super(name, params)
  }
}
