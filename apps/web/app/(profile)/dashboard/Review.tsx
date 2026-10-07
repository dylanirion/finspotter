"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  Square2StackIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  claimReviewItem,
  getItemsForReview,
  type ReviewQueueCursor,
  type ReviewQueueItem,
} from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { Skeleton } from "components/ui/skeleton/Skeleton"
import { toast } from "react-hot-toast"

const PAGE_SIZE = 6

export function Review() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [cursors, setCursors] = useState<(ReviewQueueCursor | undefined)[]>([
    undefined,
  ])
  const cursor = cursors[page]
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["review", { limit: PAGE_SIZE, cursor }],
    queryFn: () => getItemsForReview(PAGE_SIZE, cursor),
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
  const claim = useMutation({
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

  const nextPage = () => {
    if (!data?.cursor) return
    setCursors((current) => {
      const next = current.slice(0, page + 1)
      next[page + 1] = data.cursor
      return next
    })
    setPage((current) => current + 1)
  }

  return (
    <section className="col-span-1 flex min-w-0 flex-col gap-2 md:col-span-2 xl:col-span-3">
      <div className="flex h-7 items-center justify-between">
        <h3 className="font-medium text-gray-950 dark:text-white">
          Review queue
        </h3>
        <div className="flex items-center gap-1">
          <Button
            intent="none"
            size="icon"
            className="grid size-7 place-items-center rounded-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
            disabled={page === 0 || isFetching}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-12 text-center text-xs text-gray-500 tabular-nums dark:text-slate-400">
            Page {page + 1}
          </span>
          <Button
            intent="none"
            size="icon"
            className="grid size-7 place-items-center rounded-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
            disabled={!data?.cursor || isFetching}
            onClick={nextPage}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-900">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 uppercase sm:grid-cols-[minmax(0,1fr)_6rem_7rem_2.5rem] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <span>Result</span>
          <span>Score</span>
          <span className="hidden sm:block">Date</span>
          <span className="sr-only">Open</span>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {isLoading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="grid h-14 grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] items-center gap-2 px-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_2.5rem]"
              >
                <Skeleton className="h-4 w-36 dark:bg-slate-700" />
                <Skeleton className="h-4 w-12 dark:bg-slate-700" />
                <Skeleton className="hidden h-4 w-20 sm:block dark:bg-slate-700" />
              </div>
            ))
          ) : data?.items.length ? (
            data.items.map((item) => {
              const Icon = resultIcon(item.kind)
              const isClaiming = claim.isPending && claim.variables.id === item.id
              return (
                <div
                  key={item.id}
                  className="grid min-h-14 grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] items-center gap-2 px-3 text-sm sm:grid-cols-[minmax(0,1fr)_6rem_7rem_2.5rem]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-sm text-gray-950 dark:text-white">
                      <Icon className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-950 capitalize dark:text-white">
                        {item.kind.replace("_", " ")}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                        {item.mediaId ?? item.sourcePk}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-medium text-gray-700 tabular-nums dark:text-slate-200">
                    {item.score === null ? (
                      <span className="text-amber-700 dark:text-amber-300">
                        Triage
                      </span>
                    ) : (
                      formatScore(item.score)
                    )}
                  </span>
                  <time
                    className="hidden text-xs text-gray-500 tabular-nums sm:block dark:text-slate-400"
                    dateTime={item.readyAt}
                  >
                    {formatReadyAt(item.readyAt)}
                  </time>
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
                </div>
              )
            })
          ) : (
            <div className="grid h-24 place-items-center text-sm text-gray-500 dark:text-slate-400">
              No results are waiting for review.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function resultIcon(kind: ReviewQueueItem["kind"]) {
  if (kind === "pair" || kind === "indexed_match") return Square2StackIcon
  if (kind === "extraction") return SparklesIcon
  return PhotoIcon
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

function formatScore(score: number) {
  return score.toLocaleString("en-ZA", { maximumFractionDigits: 3 })
}

function formatReadyAt(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
