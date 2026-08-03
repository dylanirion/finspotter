import "server-only"

import {
  AnnotationDataTypes,
  type AnnotationType,
} from "@finspotter/annotations"
import {
  and,
  eq,
  getTableColumns,
  sql,
  type Subquery,
  type WithSubquery,
} from "drizzle-orm"
import { type SubqueryWithSelection } from "drizzle-orm/mysql-core"
import { type MySqlQueryResult } from "drizzle-orm/mysql2"
import { Resource } from "sst"

import { type Repository } from "../"
import {
  buildFacetCounts,
  buildFacetCTE,
  buildOrderClause,
  buildWhereClause,
  db,
  type MaybeAliased,
  type Where,
} from "../_drizzle"
import { detectionsSubQuery } from "../detection"
import { detectionsTable } from "../detection/sql"
import { selectFromMediaWithExif, type Media } from "../media"
import { mediaTable } from "../media/sql"
import { annotationsIncrementerTable, annotationsTable } from "./sql"

type DetectionFunctions =
  keyof typeof Resource.MediaProcessingPipeline.detectionFunctions

export type Annotation = {
  [T in AnnotationType]: {
    id: string
    mediaId: string
    detectionId: number
    source: "manual" | DetectionFunctions | null
    category: string | null
    type: T | null
    data: AnnotationDataTypes[T] | null
    score: number | null
    updatedAt: Date
    createdBy?: string
  }
}[AnnotationType]

type AnnotationsTable = typeof annotationsTable
type AnnotationsColumns = MaybeAliased<AnnotationsTable["_"]["columns"]>

type DetectionsTable = typeof detectionsTable
type DetectionsColumns = MaybeAliased<DetectionsTable["_"]["columns"]>

type AnnotationsSubquery =
  | Subquery<string, AnnotationsColumns & DetectionsColumns>
  | SubqueryWithSelection<AnnotationsColumns & DetectionsColumns, string>
type AnnotationsCTE = WithSubquery<
  string,
  AnnotationsColumns & DetectionsColumns
>

type WithMedia<T> = T & { media: Pick<Media, "id" | "src" | "exif"> }

export type AnnotationWithMedia = WithMedia<Annotation>

type AnnotationRepository = Repository<
  AnnotationWithMedia,
  { insert: Omit<Annotation, "id">; update: Annotation }
>

const drizzleAnnotationRepository: AnnotationRepository = {
  async findOne(where: Where<"id">) {
    return selectFromAnnotationsWithDetectionAndMedia()
      .where(buildWhereClause(annotationsTable, where))
      .then((result) => (result[0] as AnnotationWithMedia) ?? null)
  },

  async findAll({ limit, offset, where, sort }) {
    const annotations = db
      .$with("annotations")
      .as(
        selectFromAnnotationsWithDetectionAndMedia().where(
          buildWhereClause(annotationsTable, {})
        )
      ) //permissions filter, probably needs media?
    const searchSpace = db.$with("search_space").as(
      db
        .select({
          id: annotations.id,
          mediaId: annotations.mediaId,
          category: annotations.category,
          type: annotations.type,
          source: annotations.source,
        })
        .from(annotations)
    )
    const filteredAnnotations = db.$with("filtered_annotations").as(
      db
        .select({
          id: searchSpace.id,
          mediaId: searchSpace.mediaId,
          category: searchSpace.category,
          type: searchSpace.type,
          source: searchSpace.source,
          sortOrder:
            sql`row_number() over (order by ${buildOrderClause(searchSpace, sort)})`.as(
              "sort_order"
            ),
        })
        .from(searchSpace)
        .where(buildWhereClause(searchSpace, where)) // search filter
    )
    const categoryFacets = buildFacetCTE(
      "category_facets",
      filteredAnnotations,
      "category"
    )
    const typeFacets = buildFacetCTE("type_facets", filteredAnnotations, "type")
    const pagedAnnotations = db.$with("paged_annotations").as(
      db
        .select({
          id: filteredAnnotations.id,
          mediaId: filteredAnnotations.mediaId,
          category: filteredAnnotations.category,
          type: filteredAnnotations.type,
          source: filteredAnnotations.source,
        })
        .from(filteredAnnotations)
        .limit(limit)
        .offset(offset)
    )
    const pagedEntries = Object.entries(pagedAnnotations._.selectedFields)
      .map(([key, value]) => [sql`'${sql.raw(key)}'`, value])
      .flat()
    return db
      .with(
        annotations,
        searchSpace,
        filteredAnnotations,
        categoryFacets,
        typeFacets,
        pagedAnnotations
      )
      .select({
        total: db.$count(annotations).as("total"),
        items: sql<
          AnnotationWithMedia[]
        >`json_arrayagg(coalesce(json_object(${sql.join(pagedEntries, sql`, `)}), json_object()))`.as(
          "items"
        ),
        facetCounts: buildFacetCounts([
          { table: categoryFacets, key: "category", value: "count" },
          { table: typeFacets, key: "type", value: "count" },
        ]),
      })
      .from(pagedAnnotations)
      .then((result) => result[0] ?? null)
  },

  async insert(annotations) {
    const now = new Date()
    const results = await Promise.all(
      annotations.map(async (annotation) => {
        const { mediaId, source, category, type, score, data, createdBy } =
          annotation
        return db.transaction(async (tx) => {
          await tx
            .update(annotationsIncrementerTable)
            .set({
              lastId: sql`last_insert_id( ${annotationsIncrementerTable.lastId} + 1 )`,
            })
            .where(eq(annotationsIncrementerTable.mediaId, mediaId))

          const [res]: MySqlQueryResult<{ lastId: number }> = (await tx.execute<
            { lastId: number }[]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          >(sql`select last_insert_id() AS lastId`)) as any
          await tx.insert(detectionsTable).values({
            mediaId,
            detectionId: res[0].lastId,
            source,
            category,
            type,
            score,
            data,
            createdAt: now,
            createdBy,
          })
          return tx
            .insert(annotationsTable)
            .values({ mediaId, detectionId: res[0].lastId, updatedAt: now })
            .$returningId()
        })
      })
    )
    return results.flat()
  },

  async update(annotation: Annotation) {
    const {
      id,
      mediaId,
      detectionId,
      source,
      category,
      type,
      score,
      data,
      updatedAt,
      createdBy,
    } = annotation
    const now = new Date()
    return db.transaction(async (tx) => {
      await tx.insert(detectionsTable).values({
        mediaId,
        detectionId,
        source,
        category,
        type,
        score,
        data,
        createdAt: now,
        createdBy,
      })
      return tx
        .update(annotationsTable)
        .set({ updatedAt: now })
        .where(
          and(
            eq(annotationsTable.id, id),
            updatedAt ? eq(annotationsTable.updatedAt, updatedAt) : undefined
          )
        )
    })
  },

  async remove(where) {
    return db
      .delete(annotationsTable)
      .where(buildWhereClause(annotationsTable, where))
  },
}

const selectFromAnnotations = () =>
  db.select().from(annotationsTable).$dynamic()

const selectFromAnnotationsWithDetection = () => {
  const detections = detectionsSubQuery()
  return db
    .select({
      ...getTableColumns(detectionsTable),
      ...getTableColumns(annotationsTable),
    })
    .from(annotationsTable)
    .leftJoinLateral(detections, sql`true`)
    .$dynamic()
}

const selectFromAnnotationsWithDetectionAndMedia = () => {
  const media = selectFromMediaWithExif()
    .where(eq(mediaTable.id, annotationsTable.mediaId))
    .as("media")
  const detections = detectionsSubQuery()
  const mediaFields = Object.entries(media._.selectedFields)
    .map(([key, value]) => [sql`'${sql.raw(key)}'`, value])
    .flat()
  return db
    .select({
      ...getTableColumns(detectionsTable),
      ...getTableColumns(annotationsTable),
      media: sql<
        Pick<Media, "id" | "src" | "exif">
      >`coalesce(json_object(${sql.join(mediaFields, sql`, `)}), json_object())`.as(
        "media"
      ),
    })
    .from(annotationsTable)
    .leftJoinLateral(detections, sql`true`)
    .leftJoinLateral(media, sql`true`)
    .$dynamic()
}

export const annotationsSubQuery = () =>
  selectFromAnnotationsWithDetection()
    .where(eq(annotationsTable.mediaId, mediaTable.id))
    .as("annotations")

export const annotationsCTE = () =>
  db.$with("annotations").as(selectFromAnnotationsWithDetection())

const selectJsonAnnotations = <
  T extends (AnnotationsSubquery | AnnotationsCTE) &
    AnnotationsColumns &
    DetectionsColumns,
>(
  source: T
) => {
  const annotationFields = Object.entries(source._.selectedFields)
    .map(([key, value]) => [sql`'${sql.raw(key)}'`, value])
    .flat()
  return db
    .select({
      mediaId: source.mediaId,
      json: sql<
        Annotation[]
      >`json_arrayagg(coalesce(json_object(${sql.join(annotationFields, sql`, `)}), json_object()))`.as(
        "annotationJson"
      ),
    })
    .from(source)
    .$dynamic()
}

export const jsonAnnotationsSubQuery = () =>
  selectJsonAnnotations(annotationsSubQuery()).as("jsonAnnotations")

export const annotationCTEs = () => {
  const annotations = annotationsCTE()
  const jsonAnnotationsCTE = db
    .$with("jsonAnnotations")
    .as(selectJsonAnnotations(annotations).groupBy(annotations.mediaId))
  return { annotations, jsonAnnotations: jsonAnnotationsCTE }
}

export function createAnnotationRepository() {
  return drizzleAnnotationRepository
}
