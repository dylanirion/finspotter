import { indexedNeighborsSchema } from "@finspotter/pipeline/indexed"

import { lnbnnConfigSchema, type LnbnnConfig } from "./schema"

export type LnbnnMatch = {
  from: number
  to: number
  distance: number
  normalizerDistance: number
  score: number
}

export type LnbnnCandidate = {
  annotation_id: string
  score: number
  matches: LnbnnMatch[]
}

export function scoreLnbnn(input: unknown, config: LnbnnConfig = {}) {
  const artifact = indexedNeighborsSchema.parse(input)
  const cfg = lnbnnConfigSchema.parse(config)
  const candidates = new Map<string, LnbnnCandidate>()
  let insufficientNeighbors = 0

  for (const [from, neighbors] of artifact.neighbors.entries()) {
    const seen = new Set<string>()
    for (const [i, neighbor] of neighbors.entries()) {
      if (i > 0 && neighbor.distance < neighbors[i - 1].distance) {
        throw new Error(`Unsorted neighbors for query feature ${from}`)
      }
      const id = JSON.stringify([neighbor.annotation_id, neighbor.feature_id])
      if (seen.has(id))
        throw new Error(`Duplicate neighbor for query feature ${from}`)
      seen.add(id)
      if (neighbor.annotation_id === artifact.query.annotation_id) {
        throw new Error("Indexed neighbors include the query annotation")
      }
    }
    if (neighbors.length < artifact.k + artifact.knorm) {
      insufficientNeighbors++
      continue
    }
    const normalizerDistance =
      neighbors[artifact.k + artifact.knorm - 1].distance
    const voted = new Set<string>()
    for (const neighbor of neighbors.slice(0, artifact.k)) {
      if (voted.has(neighbor.annotation_id)) continue
      voted.add(neighbor.annotation_id)
      const score = normalizerDistance - neighbor.distance
      if (
        score <= 0 ||
        (cfg.ratioThreshold !== undefined &&
          neighbor.distance >= cfg.ratioThreshold * normalizerDistance)
      ) {
        continue
      }
      let candidate = candidates.get(neighbor.annotation_id)
      if (!candidate) {
        candidate = {
          annotation_id: neighbor.annotation_id,
          score: 0,
          matches: [],
        }
        candidates.set(neighbor.annotation_id, candidate)
      }
      candidate.score += score
      if (!Number.isFinite(candidate.score))
        throw new Error("LNBNN score overflow")
      candidate.matches.push({
        from,
        to: neighbor.feature_id,
        distance: neighbor.distance,
        normalizerDistance,
        score,
      })
    }
  }

  return {
    version: 1 as const,
    method: "lnbnn" as const,
    distanceMetric: artifact.distanceMetric,
    query: artifact.query,
    k: artifact.k,
    knorm: artifact.knorm,
    config: cfg,
    queryFeatures: artifact.neighbors.length,
    insufficientNeighbors,
    candidates: [...candidates.values()]
      .filter(
        (candidate) =>
          candidate.score > cfg.minScore &&
          candidate.matches.length >= cfg.minMatches
      )
      .sort(
        (a, b) =>
          b.score - a.score || a.annotation_id.localeCompare(b.annotation_id)
      )
      .slice(0, cfg.limit),
  }
}
