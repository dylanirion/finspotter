"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { getItemsForReview } from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { Skeleton } from "components/ui/skeleton/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/ui/table/Table"

import {
  ReviewAction,
  ReviewDate,
  ReviewRealtimeNotice,
  ReviewResult,
  ReviewScore,
  useReviewClaim,
  useReviewRealtime,
} from "./ReviewCells"

const PREVIEW_SIZE = 6

export function Review() {
  const realtimeUnavailable = useReviewRealtime()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["review", { limit: PREVIEW_SIZE }],
    queryFn: () => getItemsForReview(PREVIEW_SIZE),
    staleTime: 10_000,
    refetchInterval: realtimeUnavailable ? 15_000 : false,
  })
  const claim = useReviewClaim()

  return (
    <section className="col-span-1 flex min-w-0 flex-col gap-2 md:col-span-2 xl:col-span-3">
      <div className="flex h-7 items-center justify-between">
        <h3>Review queue</h3>
        <Link
          href="/dashboard/review"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          View more
        </Link>
      </div>
      {realtimeUnavailable && <ReviewRealtimeNotice />}
      <div className="overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-700">
        <Table className="table-fixed">
          <TableHeader className="bg-gray-50 dark:bg-slate-700">
            <TableRow className="border-gray-300 dark:border-slate-500">
              <TableHead className="h-8 px-2">Result</TableHead>
              <TableHead className="h-8 w-20 px-2">Score</TableHead>
              <TableHead className="hidden h-8 w-36 px-2 sm:table-cell">
                Date
              </TableHead>
              <TableHead className="h-8 w-12 px-2">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white dark:bg-slate-900">
            {error ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <p role="alert">Unable to load the review queue.</p>
                  <Button intent="none" onClick={() => refetch()}>
                    Try again
                  </Button>
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              Array.from({ length: 3 }, (_, index) => (
                <TableRow
                  key={index}
                  className="border-gray-200 dark:border-slate-700"
                >
                  <TableCell className="px-2 py-3">
                    <Skeleton className="h-4 w-36 dark:bg-slate-700" />
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <Skeleton className="h-4 w-12 dark:bg-slate-700" />
                  </TableCell>
                  <TableCell className="hidden px-2 py-3 sm:table-cell">
                    <Skeleton className="h-4 w-20 dark:bg-slate-700" />
                  </TableCell>
                  <TableCell className="px-2 py-3" />
                </TableRow>
              ))
            ) : data?.items.length ? (
              data.items.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-gray-200 dark:border-slate-700"
                >
                  <TableCell className="px-2 py-3">
                    <ReviewResult item={item} />
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <ReviewScore score={item.score} />
                  </TableCell>
                  <TableCell className="hidden px-2 py-3 sm:table-cell">
                    <ReviewDate readyAt={item.readyAt} />
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <ReviewAction item={item} claim={claim} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No results are waiting for review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
