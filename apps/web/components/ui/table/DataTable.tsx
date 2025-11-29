"use client"

import { flexRender } from "@tanstack/react-table"
import { Skeleton } from "components/ui/skeleton/Skeleton"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table"
import { useTable } from "./TableProvider"

export function DataTable<TData>() {
  const { table, isLoading } = useTable<TData>()
  const { rows } = table.getRowModel()
  const columns = table.getAllColumns()
  const { pageSize } = table.getState().pagination

  return (
    <>
      {!isLoading ? (
        <div className="overflow-hidden rounded-md border border-gray-300 dark:border-slate-500">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-slate-700">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="dark:border-slate-500"
                >
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="bg-white dark:bg-slate-900">
              {rows?.length ? (
                rows.map((row) => (
                  //TODO: throws if ids are not unique, ensure this somehow? index?
                  <TableRow
                    key={row.id}
                    className="dark:border-slate-500"
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="dark:border-slate-500">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <DataTableSkeleton rows={pageSize} />
      )}
    </>
  )
}

export function DataTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="w-full overflow-hidden rounded-md border border-gray-300 dark:border-slate-500">
      <Table>
        <TableHeader className="bg-gray-50 dark:bg-slate-700">
          <TableRow className="dark:border-slate-500">
            {[...Array(4).keys()].map((i) => (
              <TableHead key={i}></TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white dark:bg-slate-900">
          {[...Array(rows).keys()].map((i) => (
            <TableRow key={i} className="dark:border-slate-500">
              {["w-1/8", "w-1/2", "w-1/4", "w-1/8"].map((td, j) => (
                <TableCell key={j} className={td}>
                  <Skeleton className={"h-6 w-full dark:bg-slate-700"} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
