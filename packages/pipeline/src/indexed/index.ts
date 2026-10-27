import { z } from "zod"

export const indexedNeighborSchema = z.object({
  annotation_id: z.string().min(1),
  feature_id: z.number().int().nonnegative(),
  distance: z.number().finite().nonnegative(),
})

export const indexedNeighborsSchema = z.object({
  version: z.literal(1),
  distanceMetric: z.enum(["l2", "squared_l2"]),
  k: z.number().int().min(1).max(100),
  knorm: z.number().int().min(1).max(100),
  query: z.object({
    pk: z.string().min(1),
    sk: z.string().startsWith("extraction#"),
    media_id: z.string().min(1),
    detection_id: z.string().min(1),
    annotation_id: z.string().min(1).optional(),
  }),
  neighbors: z.array(z.array(indexedNeighborSchema)),
})

export type IndexedNeighbors = z.infer<typeof indexedNeighborsSchema>
export type IndexedNeighbor = z.infer<typeof indexedNeighborSchema>
