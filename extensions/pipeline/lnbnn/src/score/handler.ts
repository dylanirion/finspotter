import type { StorageRepository } from "@finspotter/core/storage"
import { z } from "zod"

import { lnbnnConfigSchema } from "../schema"
import { scoreLnbnn } from "../scoring"

const eventSchema = z.object({
  payload: z.object({
    pk: z.string().min(1),
    sk: z.string().min(1),
    bucket: z.string().min(1),
    key: z.string().min(1),
  }),
  index: z.number().int().nonnegative(),
  config: lnbnnConfigSchema.nullish(),
  expires: z.number().int().nonnegative().nullish(),
})

export function createLnbnnHandler(
  storage: Pick<
    StorageRepository,
    "getObjectText" | "putObject" | "putItem" | "updateItem"
  >
) {
  return async (input: unknown) => {
    const { payload, index, config, expires } = eventSchema.parse(input)
    const bucket = z.string().min(1).parse(process.env.BUCKET)
    const table = z.string().min(1).parse(process.env.TABLE)
    const result = scoreLnbnn(
      JSON.parse(await storage.getObjectText(payload.bucket, payload.key)),
      config ?? {}
    )
    if (result.query.pk !== payload.pk) {
      throw new Error("Indexed neighbor artifact belongs to another submission")
    }
    const { media_id, detection_id } = result.query
    const prefix = `search#indexed#${media_id}#${detection_id}#${index}#lnbnn`
    const key = `${payload.pk}/indexed/${media_id}/${detection_id}/lnbnn-${index}.json`
    const sk = `${prefix}#ranking`
    const created_at = new Date().toISOString()
    await storage.putObject(
      bucket,
      key,
      JSON.stringify(result),
      "application/json"
    )
    for (const [rank, candidate] of result.candidates.entries()) {
      await storage.putItem(table, {
        pk: payload.pk,
        sk: `${prefix}#${candidate.annotation_id}`,
        type: "lnbnn",
        query: result.query,
        ref: { annotation_id: candidate.annotation_id },
        source_query: { pk: result.query.pk, sk: result.query.sk },
        score: candidate.score,
        match_count: candidate.matches.length,
        rank: rank + 1,
        index: index + 1,
        uri: { bucket, key },
        created_at,
        gsi1pk: "result",
        ...(expires != null && { expires }),
      })
    }
    await storage.putItem(table, {
      pk: payload.pk,
      sk,
      type: "lnbnn_ranking",
      query: result.query,
      uri: { bucket, key },
      candidate_count: result.candidates.length,
      insufficient_neighbors: result.insufficientNeighbors,
      index: index + 1,
      created_at,
      ...(expires != null && { expires }),
    })
    await storage.updateItem(table, {
      Key: { pk: payload.pk, sk: payload.sk },
      UpdateExpression: "SET superseded_by = :next",
      ExpressionAttributeValues: { ":next": sk },
    })
    return { pk: payload.pk, sk, bucket, key }
  }
}
