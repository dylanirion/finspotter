import "server-only"

import { eq, inArray, sql } from "drizzle-orm"

import { type Repository } from "../"
import {
  buildFacetCounts,
  buildFacetCTE,
  buildOrderClause,
  buildWhereClause,
  db,
  jsonbBuildObject,
  omitWhereColumn,
  type DatabaseTransaction,
  type Where,
} from "../_drizzle"
import {
  annotationCTEs,
  jsonAnnotationsSubQuery,
  type Annotation,
} from "../annotation"
import { annotationsTable } from "../annotation/sql"
import { exifCTEs, jsonExifSubQuery, type ExifData } from "../exif"
import { createIndividualSummaryRepository } from "../individualSummary"
import { mediaTable } from "./sql"

export interface Media {
  id: string
  src: string
  state: "pending" | "reviewed" | "rejected"
  annotations: Annotation[]
  exif: ExifData
}

export type MediaColumns = keyof typeof mediaTable.$inferSelect
type MediaRepository = Repository<Media> & {
  register: (media: { id: string; src: string }) => Promise<void>
  setSource: (id: string, src: string) => Promise<void>
}

const drizzleMediaRepository: MediaRepository = {
  async findOne(where: Where<"id">) {
    const annotations = jsonAnnotationsSubQuery()
    const exif = jsonExifSubQuery()
    return db
      .select({
        id: mediaTable.id,
        src: mediaTable.src,
        state: mediaTable.state,
        annotations: annotations.json,
        exif: exif.json,
      })
      .from(mediaTable)
      .leftJoinLateral(annotations, sql`true`)
      .leftJoinLateral(exif, sql`true`)
      .where(buildWhereClause(mediaTable, where))
      .then((result) => result[0] ?? null)
  },
  async findMany(where: Where<"id">) {
    const annotations = jsonAnnotationsSubQuery()
    const exif = jsonExifSubQuery()
    return db
      .select({
        id: mediaTable.id,
        src: mediaTable.src,
        state: mediaTable.state,
        annotations: annotations.json,
        exif: exif.json,
      })
      .from(mediaTable)
      .leftJoinLateral(annotations, sql`true`)
      .leftJoinLateral(exif, sql`true`)
      .where(buildWhereClause(mediaTable, where))
  },
  async findAll({ limit, offset, where, sort }) {
    const media = db
      .$with("media")
      .as(
        selectFromMedia().where(
          buildWhereClause(mediaTable, { state: "reviewed" })
        )
      ) //permissions filter
    const { annotations, jsonAnnotations } = annotationCTEs()
    const { exif, jsonExif, flatExif } = exifCTEs()
    const searchSpace = db.$with("search_space").as(
      db
        .select({
          id: media.id,
          src: media.src,
          state: media.state,
          category: annotations.category,
          type: annotations.type,
          contentType: flatExif.contentType,
          fileSize: flatExif.length,
          width: flatExif.width,
          height: flatExif.height,
          captureDate: flatExif.dateTime,
        })
        .from(media)
        .leftJoin(annotations, eq(annotations.mediaId, media.id))
        .leftJoin(flatExif, eq(flatExif.mediaId, media.id))
    )
    const filteredMedia = db.$with("filtered_media").as(
      db
        .select({
          id: searchSpace.id,
          src: searchSpace.src,
          state: searchSpace.state,
          category: searchSpace.category,
          type: searchSpace.type,
          sortOrder:
            sql`row_number() over (order by ${buildOrderClause(searchSpace, sort) ?? searchSpace.id}, ${searchSpace.id})`.as(
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
    const uniqueMedia = db.$with("unique_media").as(
      db
        .select({
          id: filteredMedia.id,
          src: filteredMedia.src,
          state: filteredMedia.state,
          sortOrder: sql`min(${filteredMedia.sortOrder})`.as("sort_order"),
        })
        .from(filteredMedia)
        .groupBy(filteredMedia.id, filteredMedia.src, filteredMedia.state)
    )
    const pagedMedia = db.$with("paged_media").as(
      db
        .select({
          id: uniqueMedia.id,
          src: uniqueMedia.src,
          state: uniqueMedia.state,
          sortOrder: uniqueMedia.sortOrder,
          exif: sql<ExifData>`coalesce(${jsonExif.json}, '{}'::jsonb)`.as(
            "exif"
          ),
          annotations: sql<
            Annotation[]
          >`coalesce(${jsonAnnotations.json}, '[]'::jsonb)`.as("annotations"),
        })
        .from(uniqueMedia)
        .leftJoin(jsonExif, eq(uniqueMedia.id, jsonExif.mediaId))
        .leftJoin(jsonAnnotations, eq(uniqueMedia.id, jsonAnnotations.mediaId))
        .orderBy(uniqueMedia.sortOrder, uniqueMedia.id)
        .limit(limit)
        .offset(offset)
    )
    const { sortOrder, ...pagedFields } = pagedMedia._.selectedFields
    return db
      .with(
        media,
        annotations,
        exif,
        jsonExif,
        flatExif,
        searchSpace,
        jsonAnnotations,
        filteredMedia,
        categoryFacetSource,
        typeFacetSource,
        categoryFacets,
        typeFacets,
        uniqueMedia,
        pagedMedia
      )
      .select({
        total:
          sql<number>`(select count(distinct ${filteredMedia.id}) from ${filteredMedia})`
            .mapWith(Number)
            .as("total"),
        items: sql<
          Media[]
        >`coalesce(jsonb_agg(${jsonbBuildObject<Media>(pagedFields)} order by ${sortOrder}, ${pagedMedia.id}), '[]'::jsonb)`.as(
          "items"
        ),
        facetCounts: buildFacetCounts([
          { name: "category", table: categoryFacets },
          { name: "type", table: typeFacets },
        ]),
      })
      .from(pagedMedia)
      .then((result) => result[0] ?? null)
  },

  async insert(media) {
    return db.insert(mediaTable).values(media).returning()
  },

  async update(media) {
    return db.transaction(async (tx) => {
      const updated = await tx
        .update(mediaTable)
        .set({ src: media.src, state: media.state })
        .where(eq(mediaTable.id, media.id))
        .returning()
      await refreshMediaSummaries(tx, [media.id])
      return updated
    })
  },

  async remove(where) {
    return db.transaction(async (tx) => {
      const media = await tx
        .select({ id: mediaTable.id })
        .from(mediaTable)
        .where(buildWhereClause(mediaTable, where))
        .for("update")
      if (media.length === 0) return []
      const mediaIds = media.map(({ id }) => id)
      const annotations = await tx
        .select({ individualId: annotationsTable.individualId })
        .from(annotationsTable)
        .where(inArray(annotationsTable.mediaId, mediaIds))
      const removed = await tx
        .delete(mediaTable)
        .where(inArray(mediaTable.id, mediaIds))
        .returning({ id: mediaTable.id })
      await createIndividualSummaryRepository().refresh(
        [
          ...new Set(
            annotations.flatMap(({ individualId }) =>
              individualId ? [individualId] : []
            )
          ),
        ],
        tx
      )
      return removed
    })
  },

  async register(media) {
    const [registered] = await db
      .insert(mediaTable)
      .values({ ...media, state: "pending" })
      .onConflictDoNothing()
      .returning({ id: mediaTable.id })
    if (registered) return

    const [existing] = await db
      .select({ src: mediaTable.src, state: mediaTable.state })
      .from(mediaTable)
      .where(eq(mediaTable.id, media.id))
      .limit(1)
    if (existing?.state !== "pending" || existing.src !== media.src) {
      throw new Error(`Media ${media.id} is already registered`)
    }
  },

  async setSource(id, src) {
    await db.transaction(async (tx) => {
      await tx.update(mediaTable).set({ src }).where(eq(mediaTable.id, id))
      await refreshMediaSummaries(tx, [id])
    })
  },
}

async function refreshMediaSummaries(
  tx: DatabaseTransaction,
  mediaIds: string[]
) {
  const annotations = await tx
    .select({ individualId: annotationsTable.individualId })
    .from(annotationsTable)
    .where(inArray(annotationsTable.mediaId, mediaIds))
  await createIndividualSummaryRepository().refresh(
    [
      ...new Set(
        annotations.flatMap(({ individualId }) =>
          individualId ? [individualId] : []
        )
      ),
    ],
    tx
  )
}

export const selectFromMedia = () => db.select().from(mediaTable).$dynamic()

export const selectFromMediaWithExif = () => {
  const exif = jsonExifSubQuery()
  return db
    .select({
      id: mediaTable.id,
      src: mediaTable.src,
      state: mediaTable.state,
      exif: exif.json,
    })
    .from(mediaTable)
    .leftJoinLateral(exif, sql`true`)
    .$dynamic()
}

export function createMediaRepository() {
  return drizzleMediaRepository
}
