export interface Chainable {
  readonly name: string
  _internalNext?: Chainable
  _internalCatches?: CatchProps[]
  _internalRetries?: RetryProps[]

  next: (nextStateOrChain: Chainable | ChainDefinition) => ChainDefinition
  addCatch: (catchPropsOrState: CatchProps | Chainable) => this
  addRetry: (retry?: Partial<RetryProps>) => this

  createPermissions: (
    role: aws.iam.Role,
    namePrefix: string,
    visited: Set<Chainable>
  ) => void

  getTransitions: (visited: Set<Chainable>) => void
  toJSON: () => object // Generates the ASL JSON for *this* state
}

export function isChainable(obj: unknown): obj is Chainable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "next" in obj &&
    "toJSON" in obj
  )
}

export enum TaskState {
  ALL = "States.ALL",
}

type ErrorEqual = TaskState | string

export type RetryProps = {
  ErrorEquals: ErrorEqual[]
  IntervalSeconds?: number
  MaxAttempts?: number
  BackoffRate?: number
}

const defaultRetry: RetryProps = {
  ErrorEquals: [TaskState.ALL],
  BackoffRate: 2,
  IntervalSeconds: 1,
  MaxAttempts: 3,
}

export interface Retryable {
  addRetry: (retry?: Partial<RetryProps>) => Chainable
}

export type CatchProps = {
  ErrorEquals: ErrorEqual[]
  ResultPath?: $util.Input<string | null>
  Next: Chainable | ChainDefinition
}

export interface Catchable {
  addCatch: (c: CatchProps | Chainable) => Chainable
}

export class ChainDefinition {
  public readonly startState: Chainable
  public readonly endStates: Chainable[] // States that can be chained from
  public readonly processedStates: Set<Chainable>

  constructor(
    startState: Chainable,
    endStates: Chainable[],
    processedStates = new Set<Chainable>()
  ) {
    this.processedStates = processedStates
    this.startState = startState
    // Filter out states that are terminal (like Succeed/Fail) and cannot be chained further
    this.endStates = endStates.filter(
      (s) => !(s instanceof Succeed || s instanceof Fail)
    )

    if (!startState) {
      throw new Error("ChainDefinition must have a startState.")
    }
  }

  public next(nextStateOrChain: Chainable | ChainDefinition): ChainDefinition {
    if (this.endStates.length === 0) {
      return this // Cannot chain further from any end state
    }

    // Collection for the end states resulting from all successful endState.next() calls
    const resultingEndStates: Chainable[] = []
    const processedEndStates = new Set<Chainable>()

    for (const endState of this.endStates) {
      if (processedEndStates.has(endState)) continue
      processedEndStates.add(endState)
      try {
        // This will execute StateBase.next(), Choice.next(), Succeed.next() etc.
        // based on the actual type of endState.
        const resultChainFromEndState = endState.next(nextStateOrChain)

        // resultChainFromEndState is the ChainDefinition returned by endState.next()
        // It tells us where the chain logically ends *after* continuing from this specific endState
        resultingEndStates.push(...resultChainFromEndState.endStates)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // Catch errors from states that shouldn't have .next() called (e.g., Succeed, Fail)
        // or potential errors within custom .next() implementations.
        console.error(
          `Error calling .next() on endState '${endState.name}': ${error.message}. Skipping this end state's branch continuation.`
        )
      }
    }

    // Aggregate and deduplicate the end states from all branches
    const uniqueEndStates = new Set<Chainable>()
    for (const state of resultingEndStates) {
      if (state) {
        // Ensure state is not null/undefined
        uniqueEndStates.add(state)
      }
    }
    // Return a new ChainDefinition with the original start state and the aggregated new end states from all branches
    return new ChainDefinition(
      this.startState,
      Array.from(uniqueEndStates.values()),
      this.processedStates
    )
  }

  /**
   * Traverses the graph starting from the startState to find all reachable states.
   */
  private getAllStates() {
    const reachableStates = new Set<Chainable>()
    this.startState.getTransitions(reachableStates)
    return reachableStates
  }

  /**
   * Generates the complete ASL definition object for this state machine chain.
   */
  public serialize(comment?: string): object {
    const allStates = this.getAllStates()
    const statesJSON: Record<string, object> = {}

    if (allStates.size === 0 && this.startState) {
      // Handle case where only start state exists
      statesJSON[this.startState.name] = this.startState.toJSON()
    } else {
      for (const state of allStates.values()) {
        statesJSON[state.name] = state.toJSON()
      }
    }

    if (Object.keys(statesJSON).length === 0) {
      throw new Error(
        "Cannot serialize empty chain definition (no states found)."
      )
    }

    return {
      StartAt: this.startState.name,
      States: statesJSON,
      ...(comment && { Comment: comment }),
    }
  }

  /**
   * Creates IAM permissions for all reachable states in the state machine chain.
   */
  public createPermissions(role: aws.iam.Role, prefix: string) {
    const visited = new Set<Chainable>()
    this.startState.createPermissions(role, prefix, visited)
  }
}

export function resolveStateName(
  target: Chainable | ChainDefinition | undefined
) {
  if (target instanceof ChainDefinition) {
    return target.startState.name
  } else if (isChainable(target)) {
    return target.name
  }
  return undefined
}

export function resolveStartState(
  target: Chainable | ChainDefinition | undefined
) {
  if (target instanceof ChainDefinition) {
    return target.startState
  } else if (isChainable(target)) {
    return target
  }
  return undefined
}

export function resolveChainDefinition(target: Chainable | ChainDefinition) {
  if (target instanceof ChainDefinition) {
    return target
  } else if (isChainable(target)) {
    // Determine end states for the single state
    const endStates =
      target instanceof Succeed || target instanceof Fail ? [] : [target]
    return new ChainDefinition(target, endStates)
  } else {
    throw new Error("Invalid argument. Must be Chainable or ChainDefinition.")
  }
}

export interface StateBaseParams {
  ResultPath?: $util.Input<string | null>
  ResultSelector?: $util.Input<object>
  OutputPath?: $util.Input<string>
  Comment?: $util.Input<string>
  InputPath?: $util.Input<string>
}

export abstract class StateBase implements Chainable, Retryable, Catchable {
  public _internalNext?: Chainable
  public _internalCatches?: CatchProps[]
  public _internalRetries?: RetryProps[]
  abstract readonly Type: string

  constructor(
    public name: string,
    protected params: StateBaseParams = {}
  ) {}

  addRetry(retry?: Partial<RetryProps>) {
    this._internalRetries = this._internalRetries || []
    this._internalRetries.push({ ...defaultRetry, ...retry })
    return this
  }

  addCatch(catchInput: CatchProps | Chainable) {
    this._internalCatches = this._internalCatches || []
    let catchProp: CatchProps
    if (isChainable(catchInput) || catchInput instanceof ChainDefinition) {
      // If only a state or chain is provided, wrap it in default CatchProps
      catchProp = {
        ErrorEquals: [TaskState.ALL],
        Next: catchInput,
        ResultPath: null,
      }
    } else if (
      typeof catchInput === "object" &&
      catchInput !== null &&
      "ErrorEquals" in catchInput &&
      "Next" in catchInput
    ) {
      // If it looks like CatchProps, use it directly
      if (
        !isChainable(catchInput.Next) &&
        !(catchInput.Next instanceof ChainDefinition)
      ) {
        throw new Error(
          `CatchProps.Next must be a Chainable or ChainDefinition. Received: ${typeof catchInput.Next}`
        )
      }
      catchProp = catchInput
    } else {
      throw new Error(
        "Invalid input for addCatch. Must be CatchProps, Chainable, or ChainDefinition."
      )
    }
    this._internalCatches.push(catchProp)
    return this
  }

  /**
   * Initiates or continues a chain definition.
   * Returns a ChainDefinition wrapper.
   */
  public next(nextStateOrChain: Chainable | ChainDefinition): ChainDefinition {
    const nextChain = resolveChainDefinition(nextStateOrChain)
    const currentChain = resolveChainDefinition(this)
    if (currentChain.endStates.length === 0) {
      // The current path already ends in a terminal state
      console.error(
        `Cannot append to '${this.name}' because it already ends with a terminal state ('${currentChain.startState.name}' leads to terminal state(s)).`
      )
      // Return a chain definition indicating no further chaining possible from default
      return new ChainDefinition(this, [], currentChain.processedStates)
    }

    // Link current end states to the start of the target chain
    for (const endState of currentChain.endStates) {
      // Should already be filtered, but double-check for terminal state
      if (endState instanceof Succeed || endState instanceof Fail) continue

      if (
        endState._internalNext &&
        endState._internalNext !== nextChain.startState
      ) {
        console.warn(
          `Next state '${endState.name}' in '${this.name}' already has a next state defined ('${endState._internalNext.name}'). Overwriting with '${nextChain.startState.name}'.`
        )
      }
      endState._internalNext = nextChain.startState // Perform the linking
    }

    return new ChainDefinition(
      this,
      nextChain.endStates,
      currentChain.processedStates
    )
  }

  /**
   * Traverses the graph from this node, adding reachable states to the visited set.
   */
  getTransitions(visited: Set<Chainable>) {
    if (visited.has(this)) {
      return // Already processed this instance
    }
    visited.add(this)

    // Traverse primary next state
    const nextState = resolveStartState(this._internalNext)
    if (nextState) {
      nextState.getTransitions(visited)
    }

    // Traverse catch states
    this._internalCatches?.forEach((catchBlock) => {
      const catchNextState = resolveStartState(catchBlock.Next)
      if (catchNextState) {
        catchNextState.getTransitions(visited)
      }
    })
  }

  /**
   * Generates the ASL JSON definition for *this specific state*.
   */
  toJSON(): object {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const definition: any = {
      Type: this.Type,
      ...this.params,
    }

    const nextStateName = resolveStateName(this._internalNext)
    if (nextStateName) {
      definition.Next = nextStateName
    } else if (
      this.Type !== "Succeed" &&
      this.Type !== "Fail" &&
      this.Type !== "Choice"
    ) {
      definition.End = true
    }

    if (this._internalRetries && this._internalRetries.length > 0) {
      definition.Retry = this._internalRetries
    }

    if (this._internalCatches && this._internalCatches.length > 0) {
      definition.Catch = this._internalCatches.map((c) => {
        const catchNextName = resolveStateName(c.Next)
        if (!catchNextName) {
          throw new Error(
            `Catch block in state '${this.name}' has an invalid Next target.`
          )
        }
        return {
          ErrorEquals: c.ErrorEquals,
          ...(c.ResultPath && { ResultPath: c.ResultPath }),
          Next: catchNextName,
        }
      })
    }
    return definition
  }

  /**
   * Recursively creates IAM permissions for all reachable states.
   * Uses Set of state IDs to track visited instances.
   */
  public createPermissions(
    role: aws.iam.Role,
    prefix: string,
    visited: Set<Chainable>
  ) {
    if (visited.has(this)) {
      return
    }
    visited.add(this)

    // Traverse primary next state
    const nextState = resolveStartState(this._internalNext)
    if (nextState) {
      nextState.createPermissions(role, prefix, visited)
    }

    // Traverse catch states
    this._internalCatches?.forEach((catchBlock) => {
      const catchNextState = resolveStartState(catchBlock.Next)
      if (catchNextState) {
        catchNextState.createPermissions(role, prefix, visited)
      }
    })
  }
}

export class Succeed extends StateBase {
  readonly Type = "Succeed"
  constructor(name: string, params: StateBaseParams = {}) {
    super(name, params)
  }

  // Override next to prevent chaining from a terminal state
  public next(nextStateOrChain: Chainable | ChainDefinition): ChainDefinition {
    throw new Error(
      `Cannot call .next() on a terminal state ('${this.name}' of type Succeed).`
    )
  }

  // Override addCatch/addRetry as well? Succeed states don't support these.
  addRetry(retry?: Partial<RetryProps>) {
    console.warn(
      `State '${this.name}' is Type 'Succeed' and does not support Retry. Ignoring.`
    )
    return this
  }

  addCatch(c: CatchProps | Chainable) {
    console.warn(
      `State '${this.name}' is Type 'Succeed' and does not support Catch. Ignoring.`
    )
    return this
  }

  // Override permissions as Succeed likely needs none
  public createPermissions(
    role: aws.iam.Role,
    prefix: string,
    visited: Set<Chainable>
  ) {
    if (visited.has(this)) return
    visited.add(this)
    // Succeed states typically require no specific permissions.
  }
}

interface FailParams extends StateBaseParams {
  Cause?: $util.Input<string>
  CausePath?: $util.Input<string>
  Error?: $util.Input<string>
  ErrorPath?: $util.Input<string>
}

export class Fail extends StateBase {
  readonly Type = "Fail"

  constructor(
    name: string,
    protected params: FailParams = {}
  ) {
    super(name, params) // Note: Fail states don't use Input/Output/Result Pathing in ASL
  }

  public next(nextStateOrChain: Chainable | ChainDefinition): ChainDefinition {
    throw new Error(
      `Cannot call .next() on a terminal state ('${this.name}' of type Fail).`
    )
  }

  addRetry(retry?: Partial<RetryProps>) {
    console.warn(
      `State '${this.name}' is Type 'Fail' and does not support Retry. Ignoring.`
    )
    return this
  }

  addCatch(c: CatchProps | Chainable) {
    console.warn(
      `State '${this.name}' is Type 'Fail' and does not support Catch. Ignoring.`
    )
    return this
  }

  public createPermissions(
    role: aws.iam.Role,
    prefix: string,
    visited: Set<Chainable>
  ) {
    if (visited.has(this)) return
    visited.add(this)
  }
}
