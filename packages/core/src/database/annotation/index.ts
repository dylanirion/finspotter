import "server-only"

import {
  AnnotationDataTypes,
  type AnnotationType,
} from "@finspotter/annotations"
import { and, eq, getColumns, sql } from "drizzle-orm"

import { type Repository } from "../"
import {
  buildFacetCounts,
  buildFacetCTE,
  buildOrderClause,
  buildWhereClause,
  db,
  jsonbBuildObject,
  omitWhereColumn,
  type Where,
} from "../_drizzle"
import { detectionsSubQuery } from "../detection"
import { detectionsTable } from "../detection/sql"
import { createIndividualSummaryRepository } from "../individualSummary"
import { selectFromMediaWithExif, type Media } from "../media"
import { mediaTable } from "../media/sql"
import { annotationsIncrementerTable, annotationsTable } from "./sql"

type DetectionSource = (typeof detectionsTable.$inferSelect)["source"]

export type Annotation = {
  [T in AnnotationType]: {
    id: string
    mediaId: string
    detectionId: number
    individualId: string | null
    source: DetectionSource
    category: string | null
    type: T | null
    data: AnnotationDataTypes[T] | null
    score: number | null
    updatedAt: Date
    createdBy?: string
  }
}[AnnotationType]

type WithMedia<T> = T & { media: Pick<Media, "id" | "src" | "exif"> }

export type AnnotationWithMedia = WithMedia<Annotation>

type AnnotationRepository = Repository<
  AnnotationWithMedia,
  {
    insert: Omit<Annotation, "id" | "individualId"> & {
      individualId?: string | null
    }
    update: Annotation
  }
>

const drizzleAnnotationRepository: AnnotationRepository = {
  async findOne(where: Where<"id">) {
    return selectFromAnnotationsWithDetectionAndMedia()
      .where(buildWhereClause(annotationsTable, where))
      .then((result) => (result[0] as AnnotationWithMedia) ?? null)
  },

  async findMany(where: Where<"id">) {
    return selectFromAnnotationsWithDetectionAndMedia()
      .where(buildWhereClause(annotationsTable, where))
      .then((result) => result as AnnotationWithMedia[])
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
    const categoryFacetSource = db.$with("category_facet_source").as(
      db
        .select({ id: searchSpace.id, category: searchSpace.category })
        .from(searchSpace)
        .where(
          buildWhereClause(searchSpace, omitWhereColumn(where, "category"))
        )
    )
    const typeFacetSource = db.$with("type_facet_source").as(
      db
        .select({ id: searchSpace.id, type: searchSpace.type })
        .from(searchSpace)
        .where(buildWhereClause(searchSpace, omitWhereColumn(where, "type")))
    )
    const categoryFacets = buildFacetCTE(
      "category_facets",
      categoryFacetSource,
      categoryFacetSource.category,
      categoryFacetSource.id
    )
    const typeFacets = buildFacetCTE(
      "type_facets",
      typeFacetSource,
      typeFacetSource.type,
      typeFacetSource.id
    )
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
    return db
      .with(
        annotations,
        searchSpace,
        filteredAnnotations,
        categoryFacetSource,
        typeFacetSource,
        categoryFacets,
        typeFacets,
        pagedAnnotations
      )
      .select({
        total:
          sql<number>`(select count(distinct ${filteredAnnotations.id}) from ${filteredAnnotations})`
            .mapWith(Number)
            .as("total"),
        items: sql<
          AnnotationWithMedia[]
        >`coalesce(jsonb_agg(${jsonbBuildObject<AnnotationWithMedia>(pagedAnnotations._.selectedFields)}), '[]'::jsonb)`.as(
          "items"
        ),
        facetCounts: buildFacetCounts([
          { name: "category", table: categoryFacets },
          { name: "type", table: typeFacets },
        ]),
      })
      .from(pagedAnnotations)
      .then((result) => result[0] ?? null)
  },

  async insert(annotations) {
    const now = new Date()
    const results = await Promise.all(
      annotations.map(async (annotation) => {
        const {
          mediaId,
          individualId,
          source,
          category,
          type,
          score,
          data,
          createdBy,
        } = annotation
        return db.transaction(async (tx) => {
          const [counter] = await tx
            .insert(annotationsIncrementerTable)
            .values({ mediaId, lastId: 1 })
            .onConflictDoUpdate({
              target: annotationsIncrementerTable.mediaId,
              set: {
                lastId: sql`${annotationsIncrementerTable.lastId} + 1`,
              },
            })
            .returning({ detectionId: annotationsIncrementerTable.lastId })

          if (!counter) throw new Error("Failed to allocate detection ID")

          await tx.insert(detectionsTable).values({
            mediaId,
            detectionId: counter.detectionId,
            source,
            category,
            type,
            score,
            data,
            createdAt: now,
            createdBy,
          })
          const inserted = await tx
            .insert(annotationsTable)
            .values({
              mediaId,
              detectionId: counter.detectionId,
              individualId,
              updatedAt: now,
            })
            .returning({
              id: annotationsTable.id,
              individualId: annotationsTable.individualId,
            })

          if (individualId)
            await createIndividualSummaryRepository().refresh(
              [individualId],
              tx
            )
          return inserted
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
      individualId,
    } = annotation
    const now = new Date()
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select({ individualId: annotationsTable.individualId })
        .from(annotationsTable)
        .where(eq(annotationsTable.id, id))
        .for("update")

      if (!current) throw new Error(`Annotation ${id} not found`)

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
      const updated = await tx
        .update(annotationsTable)
        .set({ individualId, updatedAt: now })
        .where(
          and(
            eq(annotationsTable.id, id),
            updatedAt ? eq(annotationsTable.updatedAt, updatedAt) : undefined
          )
        )
        .returning({ individualId: annotationsTable.individualId })

      if (updated.length === 0) throw new Error(`Annotation ${id} was modified`)

      await createIndividualSummaryRepository().refresh(
        [
          ...new Set(
            [current.individualId, individualId].filter(
              (affectedId): affectedId is string => affectedId !== null
            )
          ),
        ],
        tx
      )
      return updated
    })
  },

  async remove(where) {
    return db.transaction(async (tx) => {
      const removed = await tx
        .delete(annotationsTable)
        .where(buildWhereClause(annotationsTable, where))
        .returning({ individualId: annotationsTable.individualId })
      await createIndividualSummaryRepository().refresh(
        [
          ...new Set(
            removed.flatMap(({ individualId }) =>
              individualId === null ? [] : [individualId]
            )
          ),
        ],
        tx
      )
      return removed
    })
  },
}

const selectFromAnnotationsWithDetection = () => {
  const detections = detectionsSubQuery()
  return db
    .select({
      ...getColumns(detectionsTable),
      ...getColumns(annotationsTable),
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
  return db
    .select({
      ...getColumns(detectionsTable),
      ...getColumns(annotationsTable),
      media: jsonbBuildObject<Pick<Media, "id" | "src" | "exif">>(
        media._.selectedFields
      ).as("media"),
    })
    .from(annotationsTable)
    .leftJoinLateral(detections, sql`true`)
    .leftJoinLateral(media, sql`true`)
    .$dynamic()
}

export const annotationsCTE = () =>
  db.$with("annotations").as(selectFromAnnotationsWithDetection())

export const jsonAnnotationsSubQuery = () => {
  const annotations = selectFromAnnotationsWithDetection()
    .where(eq(annotationsTable.mediaId, mediaTable.id))
    .as("annotations")

  return db
    .select({
      json: sql<
        Annotation[]
      >`coalesce(jsonb_agg(${jsonbBuildObject<Annotation>(annotations._.selectedFields)}), '[]'::jsonb)`.as(
        "annotationJson"
      ),
    })
    .from(annotations)
    .as("jsonAnnotations")
}

export const annotationCTEs = () => {
  const annotations = annotationsCTE()
  const jsonAnnotationsCTE = db.$with("jsonAnnotations").as(
    db
      .select({
        mediaId: annotations.mediaId,
        json: sql<
          Annotation[]
        >`coalesce(jsonb_agg(${jsonbBuildObject<Annotation>(annotations._.selectedFields)}), '[]'::jsonb)`.as(
          "annotationJson"
        ),
      })
      .from(annotations)
      .groupBy(annotations.mediaId)
  )
  return { annotations, jsonAnnotations: jsonAnnotationsCTE }
}

export function createAnnotationRepository() {
  return drizzleAnnotationRepository
}
