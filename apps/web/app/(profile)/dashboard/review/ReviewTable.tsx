"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { getReviewQueuePage, type ReviewQueueItem } from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { DataTable } from "components/ui/table/DataTable"
import { SortableColumnHeader } from "components/ui/table/SortableColumnHeader"
import { TablePagination } from "components/ui/table/TablePagination"
import { TableProvider, useTable } from "components/ui/table/TableProvider"

import {
  ReviewAction,
  ReviewDate,
  ReviewRealtimeNotice,
  ReviewResult,
  ReviewScore,
  useReviewClaim,
  useReviewRealtime,
} from "../ReviewCells"

export function ReviewTable() {
  const realtimeUnavailable = useReviewRealtime()
  const claim = useReviewClaim()
  const columns: ColumnDef<ReviewQueueItem>[] = [
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <SortableColumnHeader column={column} header="Result" />
      ),
      cell: ({ row }) => <ReviewResult item={row.original} />,
    },
    {
      accessorKey: "score",
      header: ({ column }) => (
        <SortableColumnHeader column={column} header="Score" />
      ),
      cell: ({ row }) => <ReviewScore score={row.original.score} />,
    },
    {
      accessorKey: "readyAt",
      header: ({ column }) => (
        <SortableColumnHeader column={column} header="Date" />
      ),
      cell: ({ row }) => <ReviewDate readyAt={row.original.readyAt} />,
    },
    {
      id: "review",
      enableSorting: false,
      header: () => <span className="sr-only">Open</span>,
      cell: ({ row }) => <ReviewAction item={row.original} claim={claim} />,
    },
  ]

  return (
    <TableProvider<ReviewQueueItem>
      name="review"
      columns={columns}
      queryFn={getReviewQueuePage}
      defaultSort={[{ id: "score", desc: true }]}
      refetchInterval={realtimeUnavailable ? 15_000 : false}
    >
      {realtimeUnavailable && <ReviewRealtimeNotice />}
      <ReviewTableContent />
    </TableProvider>
  )
}

function ReviewTableContent() {
  const { error, refetch } = useTable<ReviewQueueItem>()

  if (error) {
    return (
      <div className="py-6 text-center">
        <p role="alert">Unable to load the review queue.</p>
        <Button intent="none" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <DataTable<ReviewQueueItem> />
      <TablePagination<ReviewQueueItem>
        className="bg-gray-50 p-2 text-sm font-semibold text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-300 dark:bg-slate-700 dark:ring-slate-500 dark:hover:bg-slate-600"
        maxButtons={7}
      />
    </div>
  )
}
