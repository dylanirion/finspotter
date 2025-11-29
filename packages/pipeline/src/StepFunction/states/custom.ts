import { Retryable, StateBase, type StateBaseParams } from "../state"

export interface CustomParams extends StateBaseParams {
  Type: string
  [key: string]: unknown
}

export class Custom extends StateBase implements Retryable {
  readonly Type = "__Custom"

  constructor(
    public name: string,
    protected params: CustomParams
  ) {
    super(name, params)
  }

  override toJSON() {
    if (!this.params.Type) {
      throw new Error(`Custom state "${this.name}" must include a 'Type' field`)
    }

    return {
      ...super.toJSON(),
      ...this.params,
    }
  }
}
