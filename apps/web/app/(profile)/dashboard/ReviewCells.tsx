"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  PhotoIcon,
  SparklesIcon,
  Square2StackIcon,
} from "@heroicons/react/24/outline"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  claimReviewItem,
  type Event,
  type ReviewQueueItem,
} from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { useRealtime } from "hooks/useRealtime"
import { toast } from "react-hot-toast"

export function useReviewRealtime() {
  const queryClient = useQueryClient()
  const { connect } = useRealtime()
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["review"] })
    }

    const start = async () => {
      try {
        const channel = await connect("pipeline/*")
        if (cancelled) {
          channel.close()
          return
        }
        const subscription = channel.subscribe({
          next: (data: Event) => {
            if (
              "invalidate" in data.event ||
              ["succeeded", "failed"].includes(data.event.status)
            ) {
              // Allow the asynchronous review-result projection to complete.
              clearTimeout(timeout)
              timeout = setTimeout(refresh, 1500)
            }
          },
          error: (error) => {
            console.error("Review queue realtime subscription failed", error)
            if (!cancelled) setUnavailable(true)
          },
        })
        unsubscribe = () => subscription.unsubscribe()
        setUnavailable(false)
        refresh()
      } catch (error) {
        console.error("Review queue realtime connection failed", error)
        if (!cancelled) setUnavailable(true)
      }
    }
    void start()

    return () => {
      cancelled = true
      unsubscribe?.()
      clearTimeout(timeout)
    }
  }, [connect, queryClient])

  return unavailable
}

export function ReviewRealtimeNotice() {
  return (
    <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
      Live updates are unavailable; refreshing every 15 seconds.
    </p>
  )
}

export function useReviewClaim() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: ReviewQueueItem) => claimReviewItem(item.id),
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({ queryKey: ["review"] })
      router.push(buildReviewHref(item))
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["review"] })
      toast.error(
        error instanceof Error ? error.message : "Unable to claim review item."
      )
    },
  })
}

export function ReviewResult({ item }: { item: ReviewQueueItem }) {
  const Icon =
    item.kind === "pair" || item.kind === "indexed_match"
      ? Square2StackIcon
      : item.kind === "extraction"
        ? SparklesIcon
        : PhotoIcon

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Icon aria-hidden="true" className="size-6 shrink-0" />
      <div className="min-w-0">
        <p className="truncate font-medium capitalize">
          {item.kind.replace("_", " ")}
        </p>
        <p className="truncate text-xs text-gray-500 dark:text-slate-400">
          {item.mediaId ?? item.sourcePk}
        </p>
      </div>
    </div>
  )
}

export function ReviewScore({ score }: { score: number | null }) {
  return (
    <span className="font-mono text-xs font-medium tabular-nums">
      {score === null ? (
        <span className="text-amber-700 dark:text-amber-300">Triage</span>
      ) : (
        score.toLocaleString("en-ZA", { maximumFractionDigits: 3 })
      )}
    </span>
  )
}

export function ReviewDate({ readyAt }: { readyAt: string }) {
  return (
    <time
      className="text-xs whitespace-nowrap text-gray-500 tabular-nums dark:text-slate-400"
      dateTime={readyAt}
    >
      {new Intl.DateTimeFormat("en-ZA", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(readyAt))}
    </time>
  )
}

export function ReviewAction({
  item,
  claim,
}: {
  item: ReviewQueueItem
  claim: ReturnType<typeof useReviewClaim>
}) {
  const isClaiming = claim.isPending && claim.variables.id === item.id
  return (
    <Button
      intent="none"
      size="icon"
      className="grid size-8 place-items-center rounded-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 dark:text-indigo-300 dark:hover:bg-indigo-950"
      disabled={claim.isPending}
      onClick={() => claim.mutate(item)}
      title={`Review ${item.kind.replace("_", " ")}`}
      aria-label={`Review ${item.kind.replace("_", " ")}`}
    >
      <ArrowRightIcon
        className={`size-4 ${isClaiming ? "animate-pulse" : ""}`}
      />
    </Button>
  )
}

function buildReviewHref(item: ReviewQueueItem) {
  const payload = item.payload as {
    detection_id?: string
    query?: { media_id?: string; detection_id?: string }
    ref?: { media_id?: string; detection_id?: string }
  }
  const mediaId = item.mediaId ?? payload.query?.media_id
  const detectionId = payload.detection_id ?? payload.query?.detection_id
  const params = new URLSearchParams({ review: item.id })
  if (payload.ref?.media_id) params.set("referenceMedia", payload.ref.media_id)
  if (payload.ref?.detection_id)
    params.set("referenceDetection", payload.ref.detection_id)

  return `/admin/review/${mediaId ?? "unknown"}${detectionId ? `/${detectionId}` : ""}?${params}`
}
