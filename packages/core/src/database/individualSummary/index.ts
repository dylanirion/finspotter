import "server-only"

import { sql } from "drizzle-orm"

import { type Repository } from "../"
import {
  buildFacetCounts,
  buildFacetCTE,
  buildOrderClause,
  buildWhereClause,
  db,
  jsonbBuildObject,
  omitWhereColumn,
} from "../_drizzle"
import { individualsTable } from "../individual/sql"
import { individualSummariesTable } from "./sql"

type SummaryExecutor = Pick<typeof db, "execute">

export interface IndividualSummary {
  id: string
  canonicalNames: string[]
  nickNames: string[]
  src: string | null
  species: string | null
  totalEncounters: number
  lastSeen: string | null
  // lastSeenLocation: string | null
}

type SummaryRepository = Pick<Repository<IndividualSummary>, "findAll"> & {
  refresh: (
    individualIds: string[],
    executor?: SummaryExecutor
  ) => Promise<unknown>
  refreshAll: () => Promise<unknown>
}

const drizzleIndividualSummaryRepository: SummaryRepository = {
  async findAll({ limit, offset, where, sort }) {
    const filteredIndividuals = db.$with("filtered_individuals").as(
      db
        .select({
          id: individualSummariesTable.id,
          canonicalNames: individualSummariesTable.canonicalNames,
          nickNames: individualSummariesTable.nickNames,
          species: individualSummariesTable.species,
          totalEncounters: individualSummariesTable.totalEncounters,
          lastSeen: individualSummariesTable.lastSeen,
          // lastSeenLocation: individualSummariesTable.lastSeenLocation,
          src: individualSummariesTable.src,
        })
        .from(individualSummariesTable)
        .where(buildWhereClause(individualSummariesTable, where))
    )
    const speciesFacetSource = db.$with("species_facet_source").as(
      db
        .select({
          id: individualSummariesTable.id,
          species: individualSummariesTable.species,
        })
        .from(individualSummariesTable)
        .where(
          buildWhereClause(
            individualSummariesTable,
            omitWhereColumn(where, "species")
          )
        )
    )
    const speciesFacets = buildFacetCTE(
      "species_facets",
      speciesFacetSource,
      speciesFacetSource.species,
      speciesFacetSource.id
    )
    const pagedIndividuals = db.$with("paged_individuals").as(
      db
        .select()
        .from(filteredIndividuals)
        .orderBy(
          buildOrderClause(filteredIndividuals, sort) ?? filteredIndividuals.id
        )
        .limit(limit)
        .offset(offset)
    )

    return db
      .with(
        filteredIndividuals,
        speciesFacetSource,
        speciesFacets,
        pagedIndividuals
      )
      .select({
        total: sql<number>`(select count(*) from ${filteredIndividuals})`
          .mapWith(Number)
          .as("total"),
        items: sql<
          IndividualSummary[]
        >`coalesce(jsonb_agg(${jsonbBuildObject<IndividualSummary>(pagedIndividuals._.selectedFields)}), '[]'::jsonb)`.as(
          "items"
        ),
        facetCounts: buildFacetCounts([
          { name: "species", table: speciesFacets },
        ]),
      })
      .from(pagedIndividuals)
      .then((result) => result[0])
  },

  async refresh(individualIds, executor = db) {
    if (individualIds.length === 0) return

    return executor.execute(sql`
      with requested_individuals as (
        select id
        from individuals
        where id = any(${individualIds}::uuid[])
      ),
      name_summary as (
        select
          individual_id,
          coalesce(array_agg(distinct value order by value) filter (where type = 'canonical'), array[]::text[]) as canonical_names,
          coalesce(array_agg(distinct value order by value) filter (where type in ('nickname', 'adoption')), array[]::text[]) as nick_names
        from names
        where individual_id = any(${individualIds}::uuid[])
        group by individual_id
      ),
      encounter_source as (
        select
          annotations.individual_id,
          annotations.media_id,
          media.src,
          detections.category,
          max(to_timestamp(exif.value, 'YYYY:MM:DD HH24:MI:SS')) filter (where exif.key = 'date_time') as seen_at
        from annotations
        join media on media.id = annotations.media_id
        left join detections on
          detections.media_id = annotations.media_id
          and detections.detection_id = annotations.detection_id
          and detections.created_at = annotations.updated_at
        left join exif on exif.media_id = media.id
        where annotations.individual_id = any(${individualIds}::uuid[])
        group by annotations.individual_id, annotations.media_id, media.src, detections.category
      ),
      species_votes as (
        select
          individual_id,
          category,
          row_number() over (
            partition by individual_id
            order by count(*) desc, category asc
          ) as rank
        from encounter_source
        where category is not null
        group by individual_id, category
      ),
      encounter_summary as (
        select
          individual_id,
          count(distinct media_id)::integer as total_encounters,
          max(seen_at) as last_seen,
          (array_agg(src order by seen_at desc nulls last, media_id))[1] as src
        from encounter_source
        group by individual_id
      )
      insert into individual_summaries (
        id,
        canonical_names,
        nick_names,
        species,
        total_encounters,
        last_seen,
        src,
        updated_at
      )
      select
        requested_individuals.id,
        coalesce(name_summary.canonical_names, array[]::text[]),
        coalesce(name_summary.nick_names, array[]::text[]),
        species_votes.category,
        coalesce(encounter_summary.total_encounters, 0),
        encounter_summary.last_seen,
        encounter_summary.src,
        now()
      from requested_individuals
      left join name_summary on name_summary.individual_id = requested_individuals.id
      left join species_votes on
        species_votes.individual_id = requested_individuals.id
        and species_votes.rank = 1
      left join encounter_summary on encounter_summary.individual_id = requested_individuals.id
      on conflict (id) do update set
        canonical_names = excluded.canonical_names,
        nick_names = excluded.nick_names,
        species = excluded.species,
        total_encounters = excluded.total_encounters,
        last_seen = excluded.last_seen,
        src = excluded.src,
        updated_at = excluded.updated_at
    `)
  },

  async refreshAll() {
    const individuals = await db
      .select({ id: individualsTable.id })
      .from(individualsTable)
    return this.refresh(individuals.map(({ id }) => id))
  },
}

export function createIndividualSummaryRepository() {
  return drizzleIndividualSummaryRepository
}
