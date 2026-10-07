import { neonConfig, Pool } from "@neondatabase/serverless"
import {
  and,
  countDistinct,
  eq,
  inArray,
  is,
  isNotNull,
  or,
  sql,
  Subquery,
  type AnyColumn,
  type SQL,
} from "drizzle-orm"
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless"
import { PgColumn, type PgTable } from "drizzle-orm/pg-core"
import { Resource } from "sst"
import ws from "ws"

import { Sort as _Sort, type Where as _Where, type Operation } from "../"
import { relations } from "./schema"

export type Where<Key extends string = string> = _Where<Key, AnyColumn>
export type Sort<Key extends string = string> = _Sort<Key>

export type MaybeAliased<T> = {
  [K in keyof T]: T[K] | SQL.Aliased | PgColumn
}

// Connect only once to the database
// https://github.com/vercel/next.js/discussions/26427#discussioncomment-898067
declare const globalThis: {
  drizzleGlobal: NeonDatabase<typeof relations> | undefined
} & typeof global

function connectOnceToDatabase() {
  if (!globalThis.drizzleGlobal) {
    neonConfig.webSocketConstructor = ws
    globalThis.drizzleGlobal = drizzle({
      client: new Pool({
        connectionString: Resource.Database.host,
        max: 5,
        idleTimeoutMillis: 10000,
      }),
      relations,
      logger: process.env.NODE_ENV === "development" ? true : false,
    })
  }
  return globalThis.drizzleGlobal
}

export const db = connectOnceToDatabase()

export type DatabaseTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0]
export type DatabaseClient = typeof db | DatabaseTransaction

export function jsonbBuildObject<T>(
  fields: Record<string, AnyColumn | SQL | SQL.Aliased>
) {
  const entries = Object.entries(fields).flatMap(([key, value]) => [
    sql`${key}::text`,
    value,
  ])

  return sql<T>`jsonb_build_object(${sql.join(entries, sql`, `)})`
}

type ColumnKeys<T, TAlias extends string = string> = T extends PgTable
  ? keyof T["_"]["columns"] & string
  : T extends Subquery<TAlias, infer S>
    ? keyof S & string
    : never

export function buildOrderClause<TSource extends PgTable | Subquery>(
  table: TSource,
  sorting: Sort<ColumnKeys<TSource>>
) {
  if (sorting.length === 0) return undefined
  return sql.join(
    sorting.map((sort) => {
      const field = Object.keys(sort)[0]
      const { desc } = sort[field as keyof typeof sort]
      const column = table[field as keyof typeof table]
      if (!column) {
        throw new Error(
          `${field} not found in ${"name" in table._ ? table._.name : (table._.alias ?? "table")}`
        )
      }
      return desc ? sql`${column} desc` : sql`${column} asc`
    }),
    ", "
  )
}

function buildTextCondition(
  column: AnyColumn | SQL.Aliased | SQL,
  pattern: string,
  insensitive: boolean
) {
  const operator = insensitive ? sql`ilike` : sql`like`
  if (is(column, PgColumn) && column.dimensions > 0) {
    return sql`exists (select 1 from unnest(${column}) as search_value(value) where search_value.value ${operator} ${pattern})`
  }
  return sql`${column} ${operator} ${pattern}`
}

function buildCondition(
  column: AnyColumn | SQL.Aliased | SQL,
  operation: Operation | AnyColumn | string | number | boolean | Date
): SQL | undefined {
  if (
    typeof operation === "string" ||
    typeof operation === "number" ||
    typeof operation === "boolean" ||
    operation instanceof Date
  ) {
    return eq(column as SQL.Aliased, operation)
  }

  if (!("operator" in operation)) {
    return eq(column as SQL.Aliased, operation)
  }

  switch (operation.operator) {
    case "eq":
      return eq(column as SQL.Aliased, operation.value)
    case "like":
      return buildTextCondition(column, `%${operation.value}%`, false)
    case "ilike": {
      return buildTextCondition(column, `%${operation.value}%`, true)
    }
    case "in":
      return inArray(column as SQL.Aliased, operation.value)
    case "fuzzyIn":
      return and(
        ...(operation.value as string[]).map((v) => {
          return buildTextCondition(column, `%${v}%`, true)
        })
      )
    default:
      throw new Error(`${operation.operator} is not implemented`)
  }
}

export function buildWhereClause<TSource extends PgTable | Subquery>(
  table: TSource,
  where?: Where<ColumnKeys<TSource>>
): SQL | undefined {
  if (!where || Object.keys(where).length === 0) return undefined
  if ("and" in where) {
    return and(
      ...(where.and ?? [])
        .map((w) => buildWhereClause(table, w))
        .filter((w): w is SQL => w !== undefined)
    )
  }

  if ("or" in where) {
    return or(
      ...(where.or ?? [])
        .map((w) => buildWhereClause(table, w))
        .filter((w): w is SQL => w !== undefined)
    )
  }

  return and(
    ...Object.entries(where)
      .map(([col, op]) => {
        const column = table[col as keyof TSource] as PgColumn
        if (!column) {
          throw new Error(
            `${col} not found in ${"name" in table._ ? table._.name : (table._.alias ?? "table")}`
          )
        }
        return buildCondition(column, op)
      })
      .filter((w): w is SQL => w !== undefined)
  )
}

export function omitWhereColumn<Key extends string>(
  where: Where<Key> | undefined,
  column: string
): Where<Key> | undefined {
  if (!where) return undefined

  if ("and" in where) {
    const conditions = (where.and ?? [])
      .map((condition) => omitWhereColumn(condition, column))
      .filter((condition): condition is Where<Key> => condition !== undefined)
    return conditions.length > 0 ? { and: conditions } : undefined
  }

  if ("or" in where) {
    const conditions = (where.or ?? [])
      .map((condition) => omitWhereColumn(condition, column))
      .filter((condition): condition is Where<Key> => condition !== undefined)
    return conditions.length > 0 ? { or: conditions } : undefined
  }

  const conditions = Object.entries(where).filter(([key]) => key !== column)
  return conditions.length > 0
    ? (Object.fromEntries(conditions) as Where<Key>)
    : undefined
}

export function buildFacetCTE(
  name: string,
  source: Subquery,
  value: PgColumn | SQL.Aliased,
  countBy: PgColumn | SQL.Aliased
) {
  const valueExpression = sql`${value}`
  const countByExpression = sql`${countBy}`

  return db.$with(name).as(
    db
      .select({
        value: sql<string>`${valueExpression}`.as("value"),
        count: countDistinct(countByExpression).as("count"),
      })
      .from(source)
      .where(isNotNull(valueExpression))
      .groupBy(valueExpression)
  )
}

type Facet = {
  name: string
  table: ReturnType<typeof buildFacetCTE>
}

export function buildFacetCounts(specs: Facet[]) {
  const entries = specs.map(
    (s) =>
      sql`${s.name}, ${sql`(select coalesce(jsonb_object_agg(${s.table.value}, ${s.table.count}), '{}'::jsonb) from ${s.table})`}`
  )

  const expr = sql<
    Record<string, Record<string, number>>
  >`jsonb_build_object(${sql.join(entries, sql`, `)})`

  return expr
    .mapWith({
      mapFromDriverValue: (facets) => {
        const result: Record<string, Map<string, number>> = {}
        for (const [facet, obj] of Object.entries(facets)) {
          result[facet] = new Map(Object.entries(obj))
        }
        return result
      },
    })
    .as("facetCounts")
}

/*
export const db = drizzle(connection, {
  schema,
  mode: "default",
  logger: process.env.NODE_ENV === "development" ? true : false,
})
*/
