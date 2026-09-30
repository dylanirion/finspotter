import {
  ChainDefinition,
  resolveChainDefinition,
  resolveStartState,
  resolveStateName,
  StateBase,
  type Chainable,
  type StateBaseParams,
} from "../state"

// TODO: other comparison operators
type Comparison =
  | { IsPresent: boolean }
  | { IsString: boolean }
  | { StringEquals: string }
  | { NumericEquals: number }
  | { NumericLessThan: number }
  | { NumericLessThanPath: string }
  | { BooleanEquals: boolean }

type Condition = {
  Variable: string
} & Comparison

type LogicalOperators = {
  And?: Condition[]
  Or?: Condition[]
} & ({ And: Condition[] } | { Or: Condition[] })

type ChoiceRule =
  | (Condition & { Next: Chainable | ChainDefinition })
  | (LogicalOperators & { Next: Chainable | ChainDefinition })

export interface ChoiceParams extends StateBaseParams {
  Choices: ChoiceRule[]
  Default?: Chainable | ChainDefinition
  Next?: Chainable | ChainDefinition
}
export class Choice extends StateBase {
  readonly Type = "Choice"

  constructor(
    public name: string,
    protected params: ChoiceParams
  ) {
    super(name, params)
  }

  public override next(nextStateOrChain: Chainable | ChainDefinition) {
    if (!nextStateOrChain) {
      throw new Error(`Choice.next() requires a valid target.`)
    }

    const nextChain = resolveChainDefinition(nextStateOrChain)
    if (!nextChain?.startState) {
      throw new Error(`Choice.next() could not resolve target start state.`)
    }
    const linkNextState = nextChain.startState

    // get all branches
    const branches: (Chainable | ChainDefinition)[] = [
      ...this.params.Choices.map((c) => c.Next), // Get targets from choices
      this.params.Default, // and default target
    ].filter((b): b is Chainable | ChainDefinition => !!b)

    if (branches.length === 0) {
      console.warn(
        `'${this.name}'.next() called on Choice state, but no branches (Choices or Default) are defined to append to.`
      )
      return new ChainDefinition(this, nextChain.endStates)
    }

    const resultingEndStates: Chainable[] = []
    for (const branch of branches) {
      const currentBranchChain = resolveChainDefinition(branch) // Find ends of this specific branch

      if (currentBranchChain.endStates.length === 0) {
        console.warn(
          `Choice branch starting with '${currentBranchChain.startState.name}' for Choice '${this.name}' already ends with a terminal state or has a cycle. Cannot append target '${linkNextState.name}' to this branch.`
        )
        continue
      }

      resultingEndStates.push(...currentBranchChain.next(nextChain).endStates)
    }
    return new ChainDefinition(this, [...new Set(resultingEndStates)])
  }

  override getTransitions(visited: Set<Chainable>) {
    if (visited.has(this)) return
    visited.add(this)

    // Traverse choices
    this.params.Choices.forEach((rule) => {
      const choiceNextState = resolveStartState(rule.Next)
      if (choiceNextState) {
        choiceNextState.getTransitions(visited)
      }
    })

    // Traverse default
    const defaultState = resolveStartState(this.params.Default)
    if (defaultState) {
      defaultState.getTransitions(visited)
    }

    this._internalCatches?.forEach((catchBlock) => {
      const catchNextState = resolveStartState(catchBlock.Next)
      if (catchNextState) {
        catchNextState.getTransitions(visited)
      }
    })
  }

  override toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseJson = super.toJSON() as any
    delete baseJson.Next // Remove Next/End from base as Choice manages it
    delete baseJson.End

    if (this.params.Choices.length === 0) {
      throw new Error(
        `Choice state '${this.name}' must have at least one choice rule.`
      )
    }

    const definition = {
      ...baseJson,
      Type: this.Type,
      Choices: this.params.Choices.map((rule) => {
        const { Next, ...comparison } = rule // Separate Next from comparison fields
        const nextName = resolveStateName(Next)
        if (!nextName)
          throw new Error(
            `Choice rule in '${this.name}' has invalid Next target.`
          )
        return { ...comparison, Next: nextName }
      }),
    }

    const defaultName = resolveStateName(this.params.Default)
    if (defaultName) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const def = definition as any
      def.Default = defaultName
    } else {
      console.warn(
        `Choice state '${this.name}' has no Default transition defined. Ensure choices cover all possibilities.`
      )
    }

    return definition
  }

  override createPermissions(
    role: aws.iam.Role,
    prefix: string,
    visited: Set<Chainable>
  ) {
    super.createPermissions(role, prefix, visited)

    // Traverse choices
    this.params.Choices.forEach((rule) => {
      const choiceNextState = resolveStartState(rule.Next)
      if (choiceNextState) {
        choiceNextState.createPermissions(role, prefix, visited)
      }
    })

    // Traverse default
    const defaultState = resolveStartState(this.params.Default)
    if (defaultState) {
      defaultState.createPermissions(role, prefix, visited)
    }
  }
}
