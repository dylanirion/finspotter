import { Retryable, StateBase, StateBaseParams } from "../../state"

export interface TaskStateBaseParams<T> extends StateBaseParams {
  Resource: $util.Input<string>
  Parameters: T
  Assign?: $util.Input<Record<string, unknown>>
}

export class TaskStateBase<T> extends StateBase implements Retryable {
  readonly Type = "Task"
  constructor(
    public name: string,
    protected params: TaskStateBaseParams<T>
  ) {
    super(name, params)
  }
}
