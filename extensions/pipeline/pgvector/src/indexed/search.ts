import type { StorageRepository } from "@finspotter/core/storage"
import {
  indexedNeighborSchema,
  type IndexedNeighbors,
} from "@finspotter/pipeline/indexed"
import { z } from "zod"

import { pgVectorConfigSchema } from "../schema"

const uriSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
})
const eventSchema = z.object({
  payload: uriSchema.extend({
    pk: z.string().min(1),
    sk: z.string().startsWith("extraction#"),
  }),
  config: pgVectorConfigSchema.nullish(),
  expires: z.number().int().nonnegative().nullish(),
})
const extractionSchema = z.object({
  type: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  category: z.string().min(1),
  media_id: z.string().min(1),
  detection_id: z.coerce.string().min(1),
  annotation_id: z.string().min(1).optional(),
  uri: z.object({ features: uriSchema }),
})
const featuresSchema = z.array(z.array(z.number().finite()).min(1))
const rowSchema = indexedNeighborSchema.extend({
  query_feature_id: z.number().int().nonnegative(),
})

type SearchStorage = Pick<
  StorageRepository,
  "getObjectText" | "putObject" | "putItem"
> & {
  getItem: (table: string, key: Record<string, string>) => Promise<unknown>
}

export function createIndexedSearchHandler({
  storage,
  query,
}: {
  storage: SearchStorage
  query: (sql: string, parameters: unknown[]) => Promise<unknown[]>
}) {
  return async (input: unknown) => {
    const { payload, config, expires } = eventSchema.parse(input)
    const cfg = pgVectorConfigSchema.parse(config ?? {})
    const table = z.string().min(1).parse(process.env.TABLE)
    const bucket = z.string().min(1).parse(process.env.BUCKET)
    const extraction = extractionSchema.parse(
      await storage.getItem(table, { pk: payload.pk, sk: payload.sk })
    )
    const allowed = z
      .array(z.string())
      .parse(JSON.parse(process.env.ALLOWED_TABLES ?? "[]"))
    if (!allowed.includes(extraction.type)) {
      throw new Error(`Invalid vector table: ${extraction.type}`)
    }

    const features = featuresSchema.parse(
      JSON.parse(
        await storage.getObjectText(
          extraction.uri.features.bucket,
          extraction.uri.features.key
        )
      )
    )
    if (features.some((feature) => feature.length !== features[0].length)) {
      throw new Error("Query descriptors must have consistent dimensions")
    }
    const neighbors: IndexedNeighbors["neighbors"] = features.map(() => [])
    for (let offset = 0; offset < features.length; offset += 64) {
      const batch = features.slice(offset, offset + 64).map((embedding, i) => ({
        query_feature_id: offset + i,
        embedding: JSON.stringify(embedding),
      }))
      const rows = z.array(rowSchema).parse(
        await query(
          `select q.query_feature_id, n.annotation_id, n.feature_id, n.distance
           from jsonb_to_recordset($1::jsonb) as q(query_feature_id integer, embedding text)
           cross join lateral (
             select annotation_id, feature_id, embedding <-> q.embedding::vector as distance
             from ${extraction.type}
             where category = $2 and ($3::text is null or annotation_id <> $3)
             order by embedding <-> q.embedding::vector
             limit $4
           ) n
           order by q.query_feature_id, n.distance, n.annotation_id, n.feature_id`,
          [
            JSON.stringify(batch),
            extraction.category,
            extraction.annotation_id ?? null,
            cfg.k + cfg.knorm,
          ]
        )
      )
      for (const { query_feature_id, ...neighbor } of rows) {
        if (
          query_feature_id < offset ||
          query_feature_id >= offset + batch.length
        ) {
          throw new Error("Neighbor query returned an invalid query feature ID")
        }
        neighbors[query_feature_id].push(
          indexedNeighborSchema.parse({
            ...neighbor,
            distance: neighbor.distance ** 2,
          })
        )
      }
    }

    const artifact: IndexedNeighbors = {
      version: 1,
      distanceMetric: "squared_l2",
      ...cfg,
      query: {
        pk: payload.pk,
        sk: payload.sk,
        media_id: extraction.media_id,
        detection_id: extraction.detection_id,
        ...(extraction.annotation_id && {
          annotation_id: extraction.annotation_id,
        }),
      },
      neighbors,
    }
    const sk = `search#indexed#${extraction.media_id}#${extraction.detection_id}#neighbors`
    const key = `${payload.pk}/indexed/${extraction.media_id}/${extraction.detection_id}/neighbors.json`
    await storage.putObject(
      bucket,
      key,
      JSON.stringify(artifact),
      "application/json"
    )
    await storage.putItem(table, {
      pk: payload.pk,
      sk,
      type: "indexed_neighbors",
      query: artifact.query,
      source_query: { pk: payload.pk, sk: payload.sk },
      uri: { bucket, key },
      created_at: new Date().toISOString(),
      ...(expires != null && { expires }),
    })
    return { pk: payload.pk, sk, bucket, key }
  }
}
