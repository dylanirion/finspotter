import { type IndividualSummary } from "@finspotter/core/individual"
import { flexRender } from "@tanstack/react-table"
import { useTable } from "components/ui/table/TableProvider"

import { IndividualCard, IndividualCardSkeleton } from "./IndividualCard"

export function DataGrid<TData>() {
  const { table, isLoading } = useTable<TData>()
  const { rows } = table.getRowModel()
  const { pageSize } = table.getState().pagination
  return (
    <>
      {!isLoading ? (
        <div className="flex flex-wrap place-content-center gap-5">
          {rows?.length ? (
            rows.map((row) => (
              <IndividualCard
                key={row.id}
                props={row.original as IndividualSummary}
              />
            ))
          ) : (
            <div className="h-24 text-center">No results.</div>
          )}
        </div>
      ) : (
        <DataGridSkeleton cards={pageSize} />
      )}
    </>
  )
}

export function DataGridSkeleton({ cards }: { cards: number }) {
  return (
    <div className="flex flex-wrap place-content-center gap-5">
      {[...Array(cards).keys()].map((row) => (
        <div key={row}>{flexRender(IndividualCardSkeleton, {})}</div>
      ))}
    </div>
  )
}
