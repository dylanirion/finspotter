export type PairJobState =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"

export type PairReviewStatus =
  | "ready"
  | "claimed"
  | "approved"
  | "rejected"
  | "inferred"

export type ExtractionReference = {
  pk: string
  sk: string
  media_id: string
  detection_id: string
  bucket: string
  key: string
}

export type PairJobItem = {
  pk: string
  sk: string
  item_type: "pair_job"
  state: PairJobState
  algorithm: string
  left: ExtractionReference
  right: ExtractionReference
  created_at: string
  updated_at: string
  attempts: number
  lease_until?: string
  result_key?: string
}

export function createPairJobKey(
  left: ExtractionReference,
  right: ExtractionReference,
  algorithm: string
) {
  const [first, second] = [left.sk, right.sk].sort()
  return `pair#${first}#${second}#${algorithm}`
}
