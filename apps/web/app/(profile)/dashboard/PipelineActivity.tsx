"use client"

import { useEffect, useState } from "react"
import { type StatusItem } from "@finspotter/core/pipeline"
import {
  CheckCircleIcon,
  EllipsisHorizontalCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getPipelineActivity, type Event } from "app/_actions/pipeline"
import { Skeleton } from "components/ui/skeleton/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/ui/table/Table"
import { useRealtime } from "hooks/useRealtime"
import { cn } from "lib/utils"

export function PipelineActivity() {
  const [realtimeUnavailable, setRealtimeUnavailable] = useState(false)
  const queryClient = useQueryClient()
  const { connect, subscribe } = useRealtime()
  const {
    data: active,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["activity"],
    queryFn: () => getPipelineActivity(3),
    refetchInterval: 15_000,
    select: (data) =>
      data.items.map((item) => ({
        id: item.pk,
        status: item.status,
        created_at: item.created_at,
      })),
  })

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const realtime = async () => {
      try {
        await connect(`pipeline/*`)
        if (cancelled) return

        const subscription = subscribe({
          next: (data: Event) => {
            if ("pk" in data.event) {
              const event = data.event
              const newData: StatusItem = {
                pk: event.pk,
                sk: "status",
                gsi1pk: "status",
                status: event.status,
                created_at: event.created_at,
              }
              console.debug("Pipeline: ", newData)
              queryClient.setQueryData(
                ["activity"],
                (oldData: { items: StatusItem[] } | undefined) => {
                  const items = oldData?.items ?? []
                  // Replace if existing, prepend if new
                  const updatedItems = items.some(
                    (item) => item.pk === newData.pk
                  )
                    ? items.map((item) =>
                        item.pk === newData.pk ? newData : item
                      )
                    : [newData, ...items]

                  // Remove duplicates, limit to 3
                  const uniqueItems = Array.from(
                    new Map(
                      updatedItems.map((item) => [item.pk, item])
                    ).values()
                  ).slice(0, 3)

                  return { items: uniqueItems }
                }
              )
              if (["succeeded", "failed"].includes(newData.status)) {
                const timeoutId = setTimeout(() => {
                  queryClient.invalidateQueries({
                    queryKey: ["review"],
                  })
                  queryClient.setQueryData(
                    ["activity"],
                    (oldData: { items: StatusItem[] } | undefined) => ({
                      items: (oldData?.items ?? []).filter(
                        (item) => item.pk !== newData.pk
                      ),
                    })
                  )
                }, 1500)

                timeouts.push(timeoutId)
              }
            }
          },
          error: (error) => {
            console.error(
              "Pipeline activity realtime subscription failed",
              error
            )
            setRealtimeUnavailable(true)
          },
        })
        unsubscribe = () => subscription.unsubscribe()
        setRealtimeUnavailable(false)
      } catch (error) {
        console.error("Pipeline activity realtime connection failed", error)
        if (!cancelled) setRealtimeUnavailable(true)
      }
    }
    void realtime()

    return () => {
      cancelled = true
      unsubscribe?.()
      timeouts.forEach(clearTimeout)
    }
  }, [connect, subscribe, queryClient])

  return (
    <div className="col-span-1 flex flex-col gap-2">
      <div className="flex h-7 items-center justify-between">
        <h3 className="font-medium text-gray-950 dark:text-white">Activity</h3>
        {realtimeUnavailable && (
          <span
            className="text-xs text-amber-700 dark:text-amber-300"
            title="Live updates are unavailable; activity refreshes every 15 seconds."
          >
            Refreshing periodically
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-700">
        <Table className="table-fixed">
          <TableHeader className="bg-gray-50 dark:bg-slate-700">
            <TableRow className="dark:border-slate-500">
              <TableHead className="h-8 w-2/3 px-1">
                <div className="inline-flex items-center text-left text-sm font-medium uppercase">
                  Start Time
                </div>
              </TableHead>
              <TableHead className="h-8 w-1/3 px-1">
                <div className="inline-flex items-center text-left text-sm font-medium uppercase">
                  Status
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="h-24 bg-white dark:bg-slate-900">
            {!isLoading ? (
              isError ? (
                <TableRow className="border-0">
                  <TableCell
                    colSpan={2}
                    className="text-center text-red-700 dark:text-red-300"
                  >
                    Unable to load pipeline activity.
                  </TableCell>
                </TableRow>
              ) : active?.length ? (
                <>
                  {active.map((item) => (
                    <TableRow key={item.id} className="h-1/3 border-0">
                      <TableCell className="w-2/3 p-1">
                        <div className="flex space-x-2 text-base whitespace-nowrap">
                          {formatStartTime(item.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="w-1/3 p-1">
                        <span
                          className={cn(
                            "inline-flex w-full items-center gap-2 text-base text-blue-700",
                            {
                              "text-green-700": item.status === "succeeded",
                              "text-red-700": item.status === "failed",
                            }
                          )}
                        >
                          {item.status === "succeeded" ? (
                            <CheckCircleIcon className="size-5 shrink-0" />
                          ) : item.status === "failed" ? (
                            <ExclamationCircleIcon className="size-5 shrink-0" />
                          ) : (
                            <EllipsisHorizontalCircleIcon className="size-5 shrink-0" />
                          )}
                          <span
                            className="flex-1 truncate first-letter:uppercase"
                            title={item.status}
                          >
                            {item.status}
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {Array.from({ length: 3 - active.length }).map((_, i) => (
                    <TableRow
                      key={`placeholder-${i}`}
                      className="h-1/3 border-0"
                    >
                      <TableCell colSpan={2} className="p-1" />
                    </TableRow>
                  ))}
                </>
              ) : (
                <TableRow key={-1} className="border-0">
                  <TableCell colSpan={2} className="text-center">
                    No activity.
                  </TableCell>
                </TableRow>
              )
            ) : (
              [...Array(3).keys()].map((i) => (
                <TableRow key={i} className="border-0">
                  <TableCell className="p-0 px-1 py-2">
                    <Skeleton className={"h-4 w-full dark:bg-slate-700"} />
                  </TableCell>
                  <TableCell className="p-0 px-1 py-2">
                    <Skeleton className={"h-4 w-full dark:bg-slate-700"} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function formatStartTime(value: string) {
  const started = new Date(value)
  if (Number.isNaN(started.getTime())) return value
  return new Intl.DateTimeFormat("en-ZA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(started)
}
