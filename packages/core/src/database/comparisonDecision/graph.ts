import { type ComparisonDecision } from "./index"

export type ComparisonObservationKey = string

export function comparisonObservationKey(
  mediaId: string,
  detectionId: number
): ComparisonObservationKey {
  return `${mediaId}:${detectionId}`
}

export function parseComparisonObservationKey(key: string) {
  const split = key.lastIndexOf(":")
  const mediaId = key.slice(0, split)
  const detectionId = Number(key.slice(split + 1))
  if (!mediaId || !Number.isInteger(detectionId))
    throw new Error("Invalid observation key in comparison graph.")
  return { mediaId, detectionId }
}

export function hasDifferentIdentityConflict(
  decisions: Pick<
    ComparisonDecision,
    "aMediaId" | "aDetectionId" | "bMediaId" | "bDetectionId" | "verdict"
  >[],
  componentMembers: Set<ComparisonObservationKey>,
  assignedMembers: Set<ComparisonObservationKey>
) {
  return decisions.some((decision) => {
    if (decision.verdict !== "different") return false
    const a = comparisonObservationKey(decision.aMediaId, decision.aDetectionId)
    const b = comparisonObservationKey(decision.bMediaId, decision.bDetectionId)
    return (
      (componentMembers.has(a) && assignedMembers.has(b)) ||
      (componentMembers.has(b) && assignedMembers.has(a)) ||
      (assignedMembers.has(a) && assignedMembers.has(b))
    )
  })
}

export function comparisonComponents(
  decisions: Pick<
    ComparisonDecision,
    "aMediaId" | "aDetectionId" | "bMediaId" | "bDetectionId" | "verdict"
  >[]
) {
  const parents = new Map<ComparisonObservationKey, ComparisonObservationKey>()

  function find(key: ComparisonObservationKey): ComparisonObservationKey {
    const parent = parents.get(key)
    if (!parent) {
      parents.set(key, key)
      return key
    }
    if (parent === key) return key
    const root = find(parent)
    parents.set(key, root)
    return root
  }

  function union(a: ComparisonObservationKey, b: ComparisonObservationKey) {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parents.set(rootB, rootA)
  }

  for (const decision of decisions) {
    const a = comparisonObservationKey(decision.aMediaId, decision.aDetectionId)
    const b = comparisonObservationKey(decision.bMediaId, decision.bDetectionId)
    find(a)
    find(b)
    if (decision.verdict === "same") union(a, b)
  }

  const components = new Map<
    ComparisonObservationKey,
    Set<ComparisonObservationKey>
  >()
  for (const key of parents.keys()) {
    const root = find(key)
    const members = components.get(root) ?? new Set()
    members.add(key)
    components.set(root, members)
  }

  const conflicts = new Set<ComparisonObservationKey>()
  for (const decision of decisions) {
    if (decision.verdict !== "different") continue
    const a = comparisonObservationKey(decision.aMediaId, decision.aDetectionId)
    const b = comparisonObservationKey(decision.bMediaId, decision.bDetectionId)
    const root = find(a)
    if (root === find(b)) conflicts.add(root)
  }

  return {
    componentFor(key: ComparisonObservationKey) {
      const root = find(key)
      return {
        id: root,
        members: components.get(root) ?? new Set([key]),
        hasDifferentConflict: conflicts.has(root),
      }
    },
    components,
    conflicts,
  }
}
