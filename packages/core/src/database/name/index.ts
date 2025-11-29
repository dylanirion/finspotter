import { eq, sql, type Subquery, type WithSubquery } from "drizzle-orm"
import { type SubqueryWithSelection } from "drizzle-orm/mysql-core"

import { Repository } from ".."
import { buildWhereClause, db, Where, type MaybeAliased } from "../_drizzle"
import { annotationsTable } from "../annotation/sql"
import { namesTable } from "./sql"

type Names = { canonical: string[]; nickname: string[] }

type NamesTable = typeof namesTable
type NamesColumns = MaybeAliased<NamesTable["_"]["columns"]>
type NamesSubquery =
  | Subquery<string, NamesColumns>
  | SubqueryWithSelection<NamesColumns, string>
type NamesCTE = WithSubquery<string, NamesColumns>

type NameRepository = Pick<Repository<Names>, "findOne">

const drizzleNamesRepository: NameRepository = {
  async findOne(where: Where<"id" | "type">) {
    const arrayNames = selectFromNamesAsArray()
      .where(buildWhereClause(namesTable, where))
      .as("array_names")
    return db
      .select({
        json: sql<
          Partial<Names>
        >`coalesce(json_objectagg(${arrayNames.type}, ${arrayNames.value}), json_object())`.as(
          "json_names"
        ),
      })
      .from(arrayNames)
      .then((result) => (result[0].json as Names) ?? null)
  },
}

const selectFromNames = () => db.select().from(namesTable).$dynamic()
const selectFromNamesAsArray = () =>
  db
    .select({
      individualId: namesTable.individualId,
      organizationId: namesTable.organizationId,
      type: namesTable.type,
      value: sql`json_arrayagg(${namesTable.value})`.as("array"),
    })
    .from(namesTable)
    .$dynamic()
const selectJsonNames = <T extends (NamesSubquery | NamesCTE) & NamesColumns>(
  source: T
) =>
  db
    .select({
      individualId: source.individualId,
      json: sql<
        Partial<Names>
      >`coalesce(json_objectagg(${source.type}, ${source.value}), json_object())`.as(
        "json_names"
      ),
    })
    .from(source)
    .$dynamic()

export const namesAsArraySubQuery = () =>
  selectFromNamesAsArray()
    .where(eq(namesTable.individualId, annotationsTable.individualId))
    .groupBy(namesTable.type)
    .as("names")

export const jsonNamesSubQuery = () =>
  selectJsonNames(namesAsArraySubQuery()).as("json_names")

export const namesAsArrayCTE = () =>
  db
    .$with("array_names")
    .as(
      selectFromNamesAsArray().groupBy(namesTable.individualId, namesTable.type)
    )

export const namesCTE = () => db.$with("names").as(selectFromNames())

export function namesCTEs() {
  const arrayNamesCTE = namesAsArrayCTE()
  const jsonNamesCTE = db
    .$with("json_names")
    .as(selectJsonNames(arrayNamesCTE).groupBy(arrayNamesCTE.individualId))
  return { names: arrayNamesCTE, jsonNames: jsonNamesCTE }
}

export function createNamesRepository() {
  return drizzleNamesRepository
}
