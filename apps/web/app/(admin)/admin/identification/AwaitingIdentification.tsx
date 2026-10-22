"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  assignProvisionalIdentity,
  getAwaitingIdentification,
  getIndividualsForAssignment,
} from "app/_actions/individuals"
import { Img } from "components/ui/images/Img"
import { Button } from "components/ui/inputs/Button"
import { toast } from "react-hot-toast"

export function AwaitingIdentification() {
  const queryClient = useQueryClient()
  const [targets, setTargets] = useState<Record<string, string>>({})
  const groups = useQuery({
    queryKey: ["awaiting-identification"],
    queryFn: getAwaitingIdentification,
  })
  const individuals = useQuery({
    queryKey: ["individual-assignment-options"],
    queryFn: getIndividualsForAssignment,
  })
  const assign = useMutation({
    mutationFn: ({
      groupId,
      mediaId,
      detectionId,
      targetIndividualId,
      merge,
    }: {
      groupId: string
      mediaId: string
      detectionId: number
      targetIndividualId: string | null
      merge: boolean
    }) =>
      assignProvisionalIdentity(
        mediaId,
        detectionId,
        targetIndividualId,
        merge
      ),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["awaiting-identification"] })
      queryClient.invalidateQueries({
        queryKey: ["individual-assignment-options"],
      })
      queryClient.invalidateQueries({ queryKey: ["individuals"] })
      setTargets((current) => {
        const next = { ...current }
        delete next[variables.groupId]
        return next
      })
      toast.success(
        result.mergedIndividualIds.length
          ? `Merged identities into ${result.individualId}.`
          : `Assigned group to ${result.individualId}.`
      )
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to assign this identity group."
      )
    },
  })

  if (groups.isLoading || individuals.isLoading)
    return <p className="text-sm text-gray-500">Loading identity groups…</p>

  if (groups.isError || individuals.isError)
    return (
      <p className="text-sm text-red-700 dark:text-red-300">
        Unable to load identity groups. Refresh the page to try again.
      </p>
    )

  const availableIndividuals = individuals.data ?? []
  const identityGroups = groups.data ?? []

  if (!identityGroups.length)
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        No approved annotations are awaiting identification.
      </div>
    )

  return (
    <div className="space-y-4">
      {identityGroups.map((group) => {
        const seed = group.observations[0]
        const selectedId = targets[group.id] ?? group.individualIds[0] ?? ""
        const groupIndividuals =
          group.individualIds.length > 1
            ? group.individualIds.map(
                (id) =>
                  availableIndividuals.find(
                    (individual) => individual.id === id
                  ) ?? { id, canonicalNames: [], nickNames: [] }
              )
            : availableIndividuals
        const selectedDiffersFromAssigned =
          !!selectedId &&
          group.individualIds.some(
            (individualId) => individualId !== selectedId
          )
        const mustMerge = group.individualIds.length > 1
        const canAssign = !group.hasDifferentConflict && !!selectedId
        const canCreate =
          !group.hasDifferentConflict && group.individualIds.length === 0
        const isPending =
          assign.isPending && assign.variables.groupId === group.id

        return (
          <article
            key={group.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <h2 className="font-semibold text-gray-950 dark:text-white">
                    {group.individualIds.length > 1
                      ? `${group.individualIds.length} identities need merging`
                      : group.observations.length === 1
                        ? "Unidentified observation"
                        : `${group.observations.length} observations in one provisional group`}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {group.individualIds.length > 1
                      ? `${group.individualIds.length} assigned identities need reconciliation`
                      : group.individualIds.length
                        ? `${group.individualIds.length} assigned identity ${group.individualIds.length === 1 ? "in" : "identities in"} this group`
                        : "No catalog identity is assigned yet"}
                  </p>
                </div>

                {group.hasDifferentConflict && (
                  <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    This group contains a confirmed “different” comparison.
                    Resolve that contradiction before assigning an identity.
                  </p>
                )}

                {group.individualIds.length > 1 &&
                  !group.hasDifferentConflict && (
                    <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      This group already contains multiple individual IDs.
                      Choosing one will explicitly merge the others into it.
                    </p>
                  )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.observations.slice(0, 8).map((observation) => (
                    <Link
                      key={observation.annotationId}
                      href={`/admin/review/${observation.mediaId}/${observation.detectionId}`}
                      className="group/observation min-w-0 overflow-hidden rounded-md border border-gray-200 dark:border-slate-700"
                    >
                      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-slate-800">
                        <Img
                          className="object-cover"
                          alt={`Observation ${observation.detectionId}`}
                          src={observation.src}
                          fill
                          sizes="(min-width: 1024px) 16rem, 50vw"
                        />
                      </div>
                      <div className="truncate p-2 text-xs text-gray-600 group-hover/observation:text-indigo-600 dark:text-slate-300">
                        {observation.category ?? "Uncategorized"} ·{" "}
                        {observation.individualId
                          ? `ID ${observation.individualId.slice(0, 8)}`
                          : "unassigned"}
                      </div>
                    </Link>
                  ))}
                  {group.observations.length > 8 && (
                    <div className="grid aspect-[4/3] place-items-center rounded-md bg-gray-50 text-sm text-gray-500 dark:bg-slate-800 dark:text-slate-300">
                      +{group.observations.length - 8} more
                    </div>
                  )}
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 lg:max-w-sm">
                <label
                  htmlFor={`identity-${group.id}`}
                  className="text-sm font-medium text-gray-700 dark:text-slate-200"
                >
                  {mustMerge
                    ? "Keep this identity after merge"
                    : "Assign to individual"}
                </label>
                <select
                  id={`identity-${group.id}`}
                  value={selectedId}
                  onChange={(event) =>
                    setTargets((current) => ({
                      ...current,
                      [group.id]: event.target.value,
                    }))
                  }
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Choose an existing individual</option>
                  {groupIndividuals.map((individual) => (
                    <option key={individual.id} value={individual.id}>
                      {formatIndividual(individual)}
                    </option>
                  ))}
                </select>
                <Button
                  intent="primary"
                  size="small"
                  disabled={!canAssign || isPending}
                  onClick={() => {
                    if (
                      selectedDiffersFromAssigned &&
                      !window.confirm(
                        "Merge the selected individual identities? All their annotations, names, tags, and adoptions will be moved to the selected identity. Retired IDs will redirect to it."
                      )
                    ) {
                      return
                    }
                    assign.mutate({
                      groupId: group.id,
                      mediaId: seed.mediaId,
                      detectionId: seed.detectionId,
                      targetIndividualId: selectedId,
                      merge: selectedDiffersFromAssigned,
                    })
                  }}
                >
                  {isPending
                    ? "Saving…"
                    : mustMerge || selectedDiffersFromAssigned
                      ? "Merge into selected individual"
                      : "Assign group"}
                </Button>
                {canCreate && (
                  <Button
                    intent="secondary"
                    size="small"
                    disabled={isPending}
                    onClick={() =>
                      assign.mutate({
                        groupId: group.id,
                        mediaId: seed.mediaId,
                        detectionId: seed.detectionId,
                        targetIndividualId: null,
                        merge: false,
                      })
                    }
                  >
                    {isPending ? "Creating…" : "Create new individual"}
                  </Button>
                )}
                {!availableIndividuals.length && (
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    No individuals exist yet. Create one from this group, or
                    leave it provisional for now.
                  </p>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function formatIndividual(individual: {
  id: string
  canonicalNames: string[]
  nickNames: string[]
}) {
  const names = [...individual.canonicalNames, ...individual.nickNames]
  return names.length
    ? `${names.join(", ")} (${individual.id.slice(0, 8)})`
    : `Unnamed (${individual.id.slice(0, 8)})`
}
