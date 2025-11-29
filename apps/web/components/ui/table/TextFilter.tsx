import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import { ColumnFilter } from "@tanstack/react-table"
import { useDebounce } from "hooks/useDebounce"

import { useTable } from "./TableProvider"

export function TextFilter<TData>({
  className,
  placeholder,
  column,
}: {
  className?: string
  placeholder?: string
  column: string
}) {
  const { table } = useTable<TData>()
  const { value = "" } =
    table.getState().columnFilters.find((filter) => filter.id === column) ??
    ({} as ColumnFilter)
  const [filter, setFilter] = useState<string>(value as string)

  const debouncedSearchFilter = useDebounce((value: string) => {
    //TODO: do I need to strip off commas and semi-colons from "value"? splits it into an array
    const currentFilters = table.getState().columnFilters
    let newFilters = [...currentFilters]

    const filterIndex = newFilters.findIndex((filter) => filter.id === column)
    if (filterIndex >= 0) {
      newFilters[filterIndex] = {
        id: column,
        value: [value],
      }
    } else {
      newFilters.push({
        id: column,
        value: [value],
      })
    }

    if (value === "") {
      newFilters = newFilters.filter((filter) => filter.id !== column)
    }

    table.setColumnFilters(newFilters)
  }, 500)

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setFilter(e.target.value)
      debouncedSearchFilter(e.target.value)
    },
    [debouncedSearchFilter]
  )

  useEffect(() => {
    value === "" && setFilter("")
    return () => {
      debouncedSearchFilter.cancel()
    }
  }, [debouncedSearchFilter, value, column])

  return (
    <input
      className={className}
      placeholder={placeholder ?? ""}
      value={filter ?? ""}
      onChange={handleSearch}
    />
  )
}
