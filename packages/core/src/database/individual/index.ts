import "server-only"

import { eq, isNotNull, sql } from "drizzle-orm"

import { Repository } from "../"
import {
  buildFacetCounts,
  buildFacetCTE,
  buildOrderClause,
  buildWhereClause,
  db,
  MaybeAliased,
  Where,
} from "../_drizzle"
import { annotationsCTE, type AnnotationWithMedia } from "../annotation"
import { annotationsTable } from "../annotation/sql"
import { detectionsSubQuery } from "../detection"
import { exifCTEs } from "../exif"
import { locationsTable } from "../location/sql"
import { selectFromMedia, type Media } from "../media"
import { mediaMetaTable, mediaTable } from "../media/sql"
import { namesAsArrayCTE, namesCTEs } from "../name"
import { individualsTable } from "./sql"

//TODO: make this it's own repository
export interface IndividualSummary {
  id: string
  canonicalNames: Array<string | null>
  nickNames: Array<string | null>
  src: string | null
  species: string
  totalEncounters: number
  lastSeen: string
}

export interface Individual {
  id: string
  names: { canonical: string[]; nickname: string[] }
  encounters: AnnotationWithMedia[]
}

type IndividualsTable = typeof individualsTable
type IndividualsColumns = MaybeAliased<IndividualsTable["_"]["columns"]>
type IndividualRepository = Pick<
  Repository<Individual, {all: IndividualSummary}>,
  "findOne" | "findAll"
>

const drizzleIndividualRepository: IndividualRepository = {
  //TODO: clean up repeated code here
  async findOne(where: Where<"id">) {
    const { exif, jsonExif } = exifCTEs()
    const media = db.$with("media").as(
      db
        .select({
          id: mediaTable.id,
          src: mediaTable.src,
          exif: jsonExif.json,
        })
        .from(mediaTable)
        .leftJoin(jsonExif, eq(jsonExif.mediaId, mediaTable.id))
        .where(buildWhereClause(mediaTable, {}))
    ) //permissions filter
    const mediaFields = Object.entries(media._.selectedFields)
      .map(([key, value]) => [sql`'${sql.raw(key)}'`, value])
      .flat()
    const detections = detectionsSubQuery()
    const annotations = db.$with("annotations_cte").as(
      db
        .select({
          individualId: annotationsTable.individualId,
          category: detections.category,
          data: detections.data,
          type: detections.type,
          media: sql<
            Pick<Media, "id" | "src" | "exif">
          >`coalesce(json_object(${sql.join(mediaFields, sql`, `)}), json_object())`.as(
            "media"
          ),
        })
        .from(annotationsTable)
        .leftJoinLateral(detections, sql`true`)
        .rightJoin(media, eq(media.id, annotationsTable.mediaId))
    )
    const annotationFields = Object.entries(annotations._.selectedFields)
      .map(([key, value]) => [sql`'${sql.raw(key)}'`, value])
      .flat()
    const { names, jsonNames } = namesCTEs()
    return db
      .with(exif, jsonExif, media, annotations, names, jsonNames)
      .select({
        id: individualsTable.id,
        names: jsonNames.json,
        encounters: sql<
          AnnotationWithMedia[]
        >`json_arrayagg(coalesce(json_object(${sql.join(annotationFields, sql`, `)}), json_object()))`.as(
          "encounters"
        ),
      })
      .from(individualsTable)
      .leftJoin(jsonNames, eq(jsonNames.individualId, individualsTable.id))
      .leftJoin(annotations, eq(annotations.individualId, individualsTable.id))
      .where(buildWhereClause(individualsTable, where))
      .then((result) => (result[0] as Individual) ?? null)
  },

  async findAll({ limit, offset, where, sort }) {
    //TODO: individuals returned will depend on visibility of attached media
    const media = db
      .$with("media")
      .as(selectFromMedia().where(buildWhereClause(mediaTable, {}))) //permissions filter
    const annotations = annotationsCTE()
    const categoryVotes = db.$with("category_votes").as(
      db
        .select({
          individualId: annotations.individualId,
          category: annotations.category,
          votes: sql`count(*)`.as("votes"),
        })
        .from(annotations)
        .where(isNotNull(annotations.individualId))
        .groupBy(annotations.individualId, annotations.category)
    )
    const category = db.$with("top_category").as(
      db
        .select({
          individualId: categoryVotes.individualId,
          category:
            sql`first_value(${categoryVotes.category}) over (partition by ${categoryVotes.individualId} order by ${categoryVotes.votes} desc)`.as(
              "top_category"
            ),
        })
        .from(categoryVotes)
    )
    const meta = db.$with("media_meta").as(
      db
        .select({
          id: media.id,
          src: media.src,
          date: sql`str_to_date(concat_ws('-', max(case when ${mediaMetaTable.key} = 'year' then ${mediaMetaTable.value} end), lpad(max(case when ${mediaMetaTable.key} = 'month' then ${mediaMetaTable.value} end), 2, '0'), lpad(coalesce(max(case when ${mediaMetaTable.key} = 'day' then ${mediaMetaTable.value} end), '01'), 2, '0')),'%Y-%m-%d')`.as(
            "date"
          ),
        })
        .from(media)
        .leftJoin(mediaMetaTable, eq(mediaMetaTable.mediaId, media.id))
        .groupBy(media.id)
    )
    const locations = db.$with("media_locations").as(
      db
        .select({
          mediaId: locationsTable.mediaId,
          description: locationsTable.description,
        })
        .from(locationsTable)
    )
    const names = namesAsArrayCTE()
    const summary = db.$with("summary").as(
      db
        .select({
          individualId: annotations.individualId,
          totalEncounters: sql`count(distinct ${meta.date})`.as(
            "total_encounters"
          ),
          lastSeenDate: sql`max(${meta.date})`.as("last_seen_date"),
          lastSeenLocation:
            sql`first_value(${locations.description}) over (partition by ${annotations.individualId} order by ${meta.date} desc)`.as(
              "last_seen_location"
            ), //TODO: this and above could json_arrayagg or coalesce to return all distinct?
          canonicalNames:
            sql`max(case when ${names.type} = 'canonical' then ${names.value} end)`.as(
              "canonical_names"
            ),
          nickNames:
            sql`max(case when ${names.type} in ('nickname', 'adoption') then ${names.value} end)`.as(
              "nick_names"
            ),
          src: sql`first_value(${meta.src}) over (partition by ${annotations.individualId} order by ${meta.date} desc)`.as(
            "media_src"
          ),
        })
        .from(annotations)
        .innerJoin(meta, eq(meta.id, annotations.mediaId))
        .leftJoin(locations, eq(locations.mediaId, annotations.mediaId))
        .leftJoin(names, eq(names.individualId, annotations.individualId))
        .where(isNotNull(annotations.individualId))
        .groupBy(annotations.individualId)
    )
    //TODO: allow searching by all dates?
    const searchSpace = db.$with("search_space").as(
      db
        .select({
          id: individualsTable.id,
          species: category.category,
          canonicalNames: summary.canonicalNames,
          nickNames: summary.nickNames,
          lastSeen: summary.lastSeenDate,
          //lastSeenLocation: summary.lastSeenLocation,
          totalEncounters: summary.totalEncounters,
          src: summary.src,
        })
        .from(individualsTable)
        .leftJoin(category, eq(category.individualId, individualsTable.id))
        .leftJoin(
          annotations,
          eq(annotations.individualId, individualsTable.id)
        )
        .innerJoin(media, eq(media.id, annotations.mediaId))
        .leftJoin(summary, eq(summary.individualId, individualsTable.id))
        .groupBy(individualsTable.id)
    )
    const filteredIndividuals = db.$with("filtered_individuals").as(
      db
        .select({
          id: searchSpace.id,
          species: searchSpace.species,
          canonicalNames: searchSpace.canonicalNames,
          nickNames: searchSpace.nickNames,
          lastSeen: searchSpace.lastSeen,
          totalEncounters: searchSpace.totalEncounters,
          src: searchSpace.src,
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
      filteredIndividuals,
      "species"
    )
    const pagedIndividuals = db.$with("paged_individuals").as(
      db
        .selectDistinct({
          id: filteredIndividuals.id,
          species: filteredIndividuals.species,
          canonicalNames: filteredIndividuals.canonicalNames,
          nickNames: filteredIndividuals.nickNames,
          lastSeen: filteredIndividuals.lastSeen,
          totalEncounters: filteredIndividuals.totalEncounters,
          src: filteredIndividuals.src,
        })
        .from(filteredIndividuals)
        .orderBy(filteredIndividuals.sortOrder)
        .limit(limit)
        .offset(offset)
    )
    const pagedEntries = Object.entries(pagedIndividuals._.selectedFields)
      .map(([key, value]) => [sql`'${sql.raw(key)}'`, value])
      .flat()
    return db
      .with(
        media,
        annotations,
        categoryVotes,
        category,
        meta,
        locations,
        names,
        summary,
        searchSpace,
        filteredIndividuals,
        categoryFacets,
        pagedIndividuals
      )
      .select({
        total: db.$count(individualsTable).as("total"),
        items: sql<
          IndividualSummary[]
        >`json_arrayagg(coalesce(json_object(${sql.join(pagedEntries, sql`, `)}), json_object()))`.as(
          "items"
        ),
        facetCounts: buildFacetCounts([
          { table: categoryFacets, key: "species", value: "count" },
        ]),
      })
      .from(pagedIndividuals)
      .then((result) => result[0] ?? null)
  },
}

const selectFromIndividuals = () =>
  db.select().from(individualsTable).$dynamic()

export function createIndividualRepository() {
  return drizzleIndividualRepository
}
