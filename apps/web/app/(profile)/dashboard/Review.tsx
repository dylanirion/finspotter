"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { getItemsForReview } from "app/_actions/pipeline"
import { Skeleton } from "components/ui/skeleton/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/ui/table/Table"

//TODO: review needs context or state to store next item for prefetch
//: also need some way of going backwards? how does this work if an item gets moved from pending to permanent? id will be same
//TODO: sort by score within date? need a way to eliminate unnecessary comparisons (transitive closure)
export function Review() {
  const { limit, lastKey } = { limit: 12, lastKey: undefined }
  const { data: items, isLoading } = useQuery({
    queryKey: ["review", { limit, lastKey }],
    queryFn: () => getItemsForReview(limit, lastKey),
  })
  //TODO: this needs to listen for lock events

  //TODO: if items.lastKey, display link to full table
  return (
    <div className="col-span-3 flex flex-col gap-2">
      Review Submissions
      <div className="overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-700">
        <Table className="table-fixed">
          <TableHeader className="bg-gray-50 dark:bg-slate-700">
            <TableRow className="dark:border-slate-500">
              <TableHead className="h-8 w-1/3 px-1">
                <div className="inline-flex items-center text-left text-sm font-medium uppercase">
                  Submission Time
                </div>
              </TableHead>
              <TableHead className="h-8 px-1">
                <div className="inline-flex items-center text-left text-sm font-medium uppercase">
                  Type
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white dark:bg-slate-900">
            {!isLoading ? (
              items?.items.length ? (
                items.items.map((item) => (
                  <TableRow key={item.sk} className="h-8 dark:border-slate-500">
                    <TableCell className="w-1/3 p-1">
                      <div className="flex space-x-2 text-base whitespace-nowrap">
                        {
                          /*new Date(Date.parse(item.created_at)).toLocaleString("en-ZA")*/
                          item.created_at
                        }
                      </div>
                    </TableCell>
                    <TableCell className="p-1">
                      <span className="inline-flex w-full items-center gap-2 text-base">
                        {buildLink(item)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow key={-1} className="h-24">
                  <TableCell colSpan={2} className="text-center">
                    No items for review.
                  </TableCell>
                </TableRow>
              )
            ) : (
              [...Array(3).keys()].map((i) => (
                <TableRow key={i} className="dark:border-slate-500">
                  <TableCell className="w-1/3 p-0 px-1 py-2">
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

function buildLink(item: {
  pk: string
  sk: string
  gsi1pk: string
  created_at: string
  final: boolean
  locked_at: string
}) {
  const parts = item.sk.split("#")
  if (parts[0].startsWith("media")) {
    return (
      <Link
        className="font-medium text-indigo-600 hover:text-indigo-700"
        href={`/admin/review/media/${parts[1]}`}
      >
        Media
      </Link>
    )
  }
  if (parts[0].startsWith("extraction")) {
    return (
      <Link
        className="font-medium text-indigo-600 hover:text-indigo-700"
        href={`/admin/review/media/${parts[1]}/${parts[2]}`}
      >
        Extraction
      </Link>
    )
  }
}
