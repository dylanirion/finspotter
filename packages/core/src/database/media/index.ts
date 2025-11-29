import "server-only"

import { eq, sql } from "drizzle-orm"

import { type Repository } from "../"
import {
  buildFacetCounts,
  buildFacetCTE,
  buildOrderClause,
  buildWhereClause,
  db,
  type Where,
} from "../_drizzle"
import {
  annotationCTEs,
  jsonAnnotationsSubQuery,
  type Annotation,
} from "../annotation"
import { exifCTEs, jsonExifSubQuery, type ExifData } from "../exif"
import { mediaTable } from "./sql"

export interface Media {
  id: string
  src: string
  annotations: Annotation[]
  exif: ExifData
}

export type MediaColumns = keyof typeof mediaTable.$inferSelect
type MediaRepository = Repository<Media>

const drizzleMediaRepository: MediaRepository = {
  async findOne(where: Where<"id">) {
    const annotations = jsonAnnotationsSubQuery()
    const exif = jsonExifSubQuery()
    return db
      .select({
        id: mediaTable.id,
        src: mediaTable.src,
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
      .as(selectFromMedia().where(buildWhereClause(mediaTable, {}))) //permissions filter
    const { annotations, jsonAnnotations } = annotationCTEs()
    const { exif, jsonExif, flatExif } = exifCTEs()
    const searchSpace = db.$with("search_space").as(
      db
        .select({
          id: media.id,
          src: media.src,
          category: annotations.category,
          type: annotations.type,
          contentType: flatExif.contentType,
          fileSize: flatExif.length,
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
          category: searchSpace.category,
          type: searchSpace.type,
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
      filteredMedia,
      "category"
    )
    const typeFacets = buildFacetCTE("type_facets", filteredMedia, "type")
    const pagedMedia = db.$with("paged_media").as(
      db
        .selectDistinct({
          id: filteredMedia.id,
          src: filteredMedia.src,
          exif: jsonExif.json,
          annotations: jsonAnnotations.json,
        })
        .from(filteredMedia)
        .leftJoin(jsonExif, eq(filteredMedia.id, jsonExif.mediaId))
        .leftJoin(
          jsonAnnotations,
          eq(filteredMedia.id, jsonAnnotations.mediaId)
        )
        .orderBy(filteredMedia.sortOrder)
        .limit(limit)
        .offset(offset)
    )
    const pagedEntries = Object.entries(pagedMedia._.selectedFields)
      .map(([key, value]) => [sql`'${sql.raw(key)}'`, value])
      .flat()
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
        categoryFacets,
        typeFacets,
        pagedMedia
      )
      .select({
        total: db.$count(media).as("total"),
        items: sql<
          Media[]
        >`json_arrayagg(coalesce(json_object(${sql.join(pagedEntries, sql`, `)}), json_object()))`.as(
          "items"
        ),
        facetCounts: buildFacetCounts([
          { table: categoryFacets, key: "category", value: "count" },
          { table: typeFacets, key: "type", value: "count" },
        ]),
      })
      .from(pagedMedia)
      .then((result) => result[0] ?? null)
  },

  async insert(media) {
    return db.insert(mediaTable).values(media).$returningId()
  },

  async update(media) {
    return db.update(mediaTable).set(media)
  },

  async remove(where) {
    return db.delete(mediaTable).where(buildWhereClause(mediaTable, where))
  },
}

export const selectFromMedia = () => db.select().from(mediaTable).$dynamic()

export const selectFromMediaWithExif = () => {
  const exif = jsonExifSubQuery()
  return db
    .select({
      id: mediaTable.id,
      src: mediaTable.src,
      exif: exif.json,
    })
    .from(mediaTable)
    .leftJoinLateral(exif, sql`true`)
    .$dynamic()
}

export function createMediaRepository() {
  return drizzleMediaRepository
}
