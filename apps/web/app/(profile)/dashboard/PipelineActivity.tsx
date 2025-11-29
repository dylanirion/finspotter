"use client"

import { useEffect, useRef } from "react"
import {
  CheckCircleIcon,
  EllipsisHorizontalCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getPipelineActivity,
  type Event,
  type StatusItem,
} from "app/_actions/pipeline"
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
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const queryClient = useQueryClient()
  const { connect, subscribe } = useRealtime()
  const { data: active, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => getPipelineActivity(3),
    select: (data) =>
      data.items.map((item) => ({
        id: item.pk,
        status: item.status,
        created_at: item.created_at,
      })),
  })

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    timeoutRefs.current = timeouts
    const realtime = async () => {
      await connect(`pipeline/*`)

      subscribe({
        next: (data: Event) => {
          if ("pk" in data.event) {
            const newData = data.event
            console.debug("Pipeline: ", newData)
            queryClient.setQueryData(
              ["activity"],
              (oldData: { items: StatusItem[] }) => {
                // Replace if existing, prepend if new
                const updatedItems = oldData.items.some(
                  (item) => item.pk === newData.pk
                )
                  ? oldData.items.map((item) =>
                      item.pk === newData.pk ? newData : item
                    )
                  : [newData, ...oldData.items]

                // Remove duplicates, limit to 3
                const uniqueItems = Array.from(
                  new Map(updatedItems.map((item) => [item.pk, item])).values()
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
                  (oldData: { items: StatusItem[] }) => ({
                    items: oldData.items.filter(
                      (item) => item.pk !== newData.pk
                    ),
                  })
                )
              }, 1500) //remove after 1.5 seconds

              timeouts.push(timeoutId)
            }
          }
        },
        error: () => {},
      })
    }
    realtime()
    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [connect, subscribe, queryClient])

  return (
    <div className="col-span-1 flex flex-col gap-2">
      Activity
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
              active?.length ? (
                <>
                  {active.map((item) => (
                    <TableRow key={item.id} className="h-1/3 border-0">
                      <TableCell className="w-2/3 p-1">
                        <div className="flex space-x-2 text-base whitespace-nowrap">
                          {
                            /*new Date(Date.parse(item.created_at)).toLocaleString("en-ZA")*/
                            item.created_at
                          }
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
                          <span className="flex-1 truncate first-letter:uppercase">
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
