import { eq, sql, type AnyColumn } from "drizzle-orm"

import { type Repository } from ".."
import { buildWhereClause, db, type Where } from "../_drizzle"
import { createIndividualSummaryRepository } from "../individualSummary"
import { namesTable } from "./sql"

export type Names = {
  canonical: string[]
  nickname: string[]
  adoption: string[]
}

type NameRepository = Omit<Pick<Repository<Names>, "findOne">, "findOne"> & {
  findOne: (where: Where<"individualId" | "type">) => Promise<Names | null>
  insert: (names: IndividualName[]) => Promise<{ id?: string }[]>
  remove: (
    where: Where<"individualId" | "organizationId" | "type" | "value">
  ) => Promise<unknown>
}

export type IndividualName = typeof namesTable.$inferInsert

const drizzleNamesRepository: NameRepository = {
  async findOne(where) {
    const arrayNames = selectFromNamesAsArray()
      .where(buildWhereClause(namesTable, where))
      .as("array_names")
    return db
      .select({
        json: sql<
          Partial<Names>
        >`coalesce(jsonb_object_agg(${arrayNames.type}, ${arrayNames.value}), '{}'::jsonb)`.as(
          "json_names"
        ),
      })
      .from(arrayNames)
      .then((result) => (result[0]?.json as Names) ?? null)
  },

  async insert(names) {
    if (names.length === 0) return []

    return db.transaction(async (tx) => {
      const stored = await tx
        .insert(namesTable)
        .values(names)
        .onConflictDoNothing()
        .returning()

      await createIndividualSummaryRepository().refresh(
        [...new Set(names.map(({ individualId }) => individualId))],
        tx
      )
      return stored.map(() => ({}))
    })
  },

  async remove(where) {
    return db.transaction(async (tx) => {
      const removed = await tx
        .delete(namesTable)
        .where(buildWhereClause(namesTable, where))
        .returning({ individualId: namesTable.individualId })

      await createIndividualSummaryRepository().refresh(
        removed.map(({ individualId }) => individualId),
        tx
      )
      return removed
    })
  },
}

const selectFromNamesAsArray = () =>
  db
    .select({
      individualId: namesTable.individualId,
      type: namesTable.type,
      value: sql<
        string[]
      >`array_agg(distinct ${namesTable.value} order by ${namesTable.value})`.as(
        "value"
      ),
    })
    .from(namesTable)
    .$dynamic()

export const namesAsArraySubQuery = (individualId: AnyColumn) =>
  selectFromNamesAsArray()
    .where(eq(namesTable.individualId, individualId))
    .groupBy(namesTable.individualId, namesTable.type)
    .as("names")

export const jsonNamesSubQuery = (individualId: AnyColumn) => {
  const names = namesAsArraySubQuery(individualId)
  return db
    .select({
      json: sql<
        Partial<Names>
      >`coalesce(jsonb_object_agg(${names.type}, ${names.value}), '{}'::jsonb)`.as(
        "json_names"
      ),
    })
    .from(names)
    .as("json_names")
}

export function createNamesRepository() {
  return drizzleNamesRepository
}
