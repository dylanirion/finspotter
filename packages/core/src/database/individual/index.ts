import "server-only"

import { eq, sql } from "drizzle-orm"

import { Repository } from "../"
import { buildWhereClause, db, jsonbBuildObject, type Where } from "../_drizzle"
import { type AnnotationWithMedia } from "../annotation"
import { annotationsTable } from "../annotation/sql"
import { detectionsSubQuery } from "../detection"
import { jsonExifSubQuery } from "../exif"
import {
  createIndividualSummaryRepository,
  type IndividualSummary,
} from "../individualSummary"
import { mediaTable } from "../media/sql"
import { jsonNamesSubQuery, type Names } from "../name"
import { individualsTable } from "./sql"

export type { IndividualSummary } from "../individualSummary"

export interface Individual {
  id: string
  names: Partial<Names>
  encounters: AnnotationWithMedia[]
}

type IndividualRepository = Pick<
  Repository<Individual, { all: IndividualSummary }>,
  "findOne" | "findAll"
>

const drizzleIndividualRepository: IndividualRepository = {
  async findOne(where: Where<"id">) {
    const names = jsonNamesSubQuery(individualsTable.id)
    const detections = detectionsSubQuery()
    const jsonExif = jsonExifSubQuery()
    const encounters = db
      .select({
        ...detections._.selectedFields,
        id: annotationsTable.id,
        mediaId: annotationsTable.mediaId,
        detectionId: annotationsTable.detectionId,
        individualId: annotationsTable.individualId,
        updatedAt: annotationsTable.updatedAt,
        media: jsonbBuildObject({
          id: mediaTable.id,
          src: mediaTable.src,
          exif: jsonExif.json,
        }).as("media"),
      })
      .from(annotationsTable)
      .leftJoinLateral(detections, sql`true`)
      .innerJoin(mediaTable, eq(mediaTable.id, annotationsTable.mediaId))
      .leftJoinLateral(jsonExif, sql`true`)
      .where(eq(annotationsTable.individualId, individualsTable.id))
      .as("encounters")
    const jsonEncounters = db
      .select({
        json: sql<
          AnnotationWithMedia[]
        >`coalesce(jsonb_agg(${jsonbBuildObject<AnnotationWithMedia>(encounters._.selectedFields)}), '[]'::jsonb)`.as(
          "json_encounters"
        ),
      })
      .from(encounters)
      .as("json_encounters")

    return db
      .select({
        id: individualsTable.id,
        names: names.json,
        encounters: jsonEncounters.json,
      })
      .from(individualsTable)
      .leftJoinLateral(names, sql`true`)
      .leftJoinLateral(jsonEncounters, sql`true`)
      .where(buildWhereClause(individualsTable, where))
      .then((result) => (result[0] as Individual) ?? null)
  },

  findAll: createIndividualSummaryRepository().findAll,
}

const selectFromIndividuals = () =>
  db.select().from(individualsTable).$dynamic()

export function createIndividualRepository() {
  return drizzleIndividualRepository
}
