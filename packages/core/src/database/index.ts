type Primitive = string | number | boolean | Date

export type Equals = {
  operator: "eq"
  value: Primitive
}

export type NotEquals = {
  operator: "ne"
  value: Primitive
}

export type Like = {
  operator: "like"
  value: Primitive
}

export type ILike = {
  operator: "ilike"
  value: Primitive
}

export type LessThan = {
  operator: "lt"
  value: number
}

export type LessThanOrEquals = {
  operator: "lte"
  value: number
}

export type GreaterThan = {
  operator: "gt"
  value: number
}

export type GreaterThanOrEquals = {
  operator: "gte"
  value: number
}

export type In = {
  operator: "in"
  value: string[] | number[] | Date[]
}

export type NotIn = {
  operator: "not_in"
  value: string[] | number[] | Date[]
}

export type FuzzyIn = {
  operator: "fuzzyIn"
  value: string[] | number[] | Date[]
}

export type StartsWith = {
  operator: "starts_with"
  value: string | number
}

export type EndsWith = {
  operator: "ends_with"
  value: string | number
}

export type Between = {
  operator: "between"
  value: [number, number]
}

export type Exists = {
  operator: "exists"
}

export type NotExists = {
  operator: "not_exists"
}

export type Operation =
  | Equals
  | NotEquals
  | Like
  | ILike
  | LessThan
  | LessThanOrEquals
  | GreaterThan
  | GreaterThanOrEquals
  | In
  | NotIn
  | FuzzyIn
  | StartsWith
  | EndsWith
  | Between
  | Exists
  | NotExists

export type Condition<Key extends string = string, TColumn = never> = {
  [K in Exclude<Key, "and" | "or">]?: Operation | Primitive | TColumn
}

type LogicalCondition<Key extends string = string, TColumn = never> = {
  and?: Where<Key, TColumn>[]
  or?: Where<Key, TColumn>[]
}

export type Direction<Key extends string = string> = Record<
  Key,
  {
    desc?: boolean
  }
>

export type Sort<Key extends string = string> = Direction<Key>[]
export type Where<Key extends string = string, TColumn = never> =
  | Condition<Key, TColumn>
  | LogicalCondition<Key, TColumn>

type StringKeys<T> = Extract<keyof T, string>
type AugmentKeys<Base, Extra> = StringKeys<Base> | StringKeys<Extra>

export interface Repository<
  T,
  TOne = T,
  TAll = T,
  TInsert = T,
  TUpdate = T,
  TAugmented = never,
  TColumn = never,
> {
  findOne: <
    W extends Where<AugmentKeys<TOne, TAugmented>, TColumn> = Where<
      AugmentKeys<TOne, TAugmented>,
      TColumn
    >,
  >(
    where: W
  ) => Promise<TOne | null>
  findMany: <
    W extends Where<AugmentKeys<TOne, TAugmented>, TColumn> = Where<
      AugmentKeys<TOne, TAugmented>,
      TColumn
    >,
  >(
    where: W
  ) => Promise<TOne[] | null>
  findAll: <
    W extends Where<AugmentKeys<TAll, TAugmented>, TColumn> = Where<
      AugmentKeys<TAll, TAugmented>,
      TColumn
    >,
    S extends Sort<AugmentKeys<TAll, TAugmented>> = Sort<
      AugmentKeys<TAll, TAugmented>
    >,
  >({
    limit,
    offset,
    where,
    sort,
  }: {
    limit: number
    offset: number
    where: W
    sort: S
  }) => Promise<{
    items: TAll[]
    facetCounts?: Record<string, Map<string, number>>
    total: number
  }>
  insert: (items: Omit<TInsert, "id">[]) => Promise<{ id?: string }[]>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (item: TUpdate) => Promise<any>
  remove: <
    W extends Where<AugmentKeys<TOne, TAugmented>, TColumn> = Where<
      AugmentKeys<TOne, TAugmented>,
      TColumn
    >,
  >(
    where: W
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>
}
