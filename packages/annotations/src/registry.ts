import type { MaterializationPlan } from "./materialization"

declare const annotationTypes: unique symbol

export type AnnotationDefinition<
  Name extends string,
  Data,
  Display,
  PackageName extends string = string,
> = {
  name: Name
  packageName: PackageName
  materialize(data: Data): MaterializationPlan
  readonly [annotationTypes]: {
    data: Data
    display: Display
  }
}

export function defineAnnotation<
  const Name extends string,
  Data,
  Display,
  const PackageName extends string,
>(
  definition: Omit<
    AnnotationDefinition<Name, Data, Display, PackageName>,
    typeof annotationTypes
  >
): AnnotationDefinition<Name, Data, Display, PackageName> {
  return definition as AnnotationDefinition<Name, Data, Display, PackageName>
}

export type AnnotationName<
  Definitions extends readonly AnnotationDefinition<
    string,
    unknown,
    unknown,
    string
  >[],
> = Definitions[number]["name"]

type AnnotationNames<
  Definitions extends readonly AnnotationDefinition<
    string,
    unknown,
    unknown,
    string
  >[],
> = {
  readonly [Index in keyof Definitions]: Definitions[Index]["name"]
}

export type AnnotationDataMap<
  Definitions extends readonly AnnotationDefinition<
    string,
    unknown,
    unknown,
    string
  >[],
> = {
  [
    Definition in Definitions[number] as Definition["name"]
  ]: Definition[typeof annotationTypes]["data"]
}

export type AnnotationDisplayMap<
  Definitions extends readonly AnnotationDefinition<
    string,
    unknown,
    unknown,
    string
  >[],
> = {
  [
    Definition in Definitions[number] as Definition["name"]
  ]: Definition[typeof annotationTypes]["display"]
}

export function createAnnotationRegistry<
  const Definitions extends readonly AnnotationDefinition<
    string,
    unknown,
    unknown,
    string
  >[],
>(definitions: Definitions) {
  type Name = AnnotationName<Definitions>
  type DataMap = AnnotationDataMap<Definitions>

  const entries = definitions.map((definition) => [definition.name, definition])
  const byName = Object.fromEntries(entries) as {
    [Definition in Definitions[number] as Definition["name"]]: Definition
  }

  return {
    types: definitions.map(
      ({ name }) => name
    ) as unknown as AnnotationNames<Definitions>,
    byName,
    materialize<T extends Name>(type: T, data: DataMap[T]) {
      const definition = byName[type] as Definitions[number]
      return (
        definition.materialize as (value: DataMap[T]) => MaterializationPlan
      )(data)
    },
  }
}
