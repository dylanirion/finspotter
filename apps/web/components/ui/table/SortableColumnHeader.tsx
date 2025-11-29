import { MouseEvent } from "react"
import { ChevronUpDownIcon } from "@heroicons/react/24/outline"
import type { Column } from "@tanstack/react-table"
import { Button } from "components/ui/inputs/Button"

export function SortableColumnHeader<TData, TValue>({
  column,
  header,
}: {
  column: Column<TData, TValue>
  header: string
}) {
  const handleSortChange = (e: MouseEvent) => {
    e.preventDefault()
    console.debug(`toggle sort ${column.id} ${column.getNextSortingOrder()}`)
    const { getToggleSortingHandler } = column
    const toggleSorting = getToggleSortingHandler()
    toggleSorting && toggleSorting(e)
  }

  return (
    <Button
      className="inline-flex cursor-pointer items-center text-left text-sm font-medium uppercase"
      intent="none"
      size="none"
      onClick={handleSortChange}
    >
      {header}
      <span className="sr-only">Sort</span>
      <ChevronUpDownIcon className="size-5" aria-hidden="true" />
    </Button>
  )
}
