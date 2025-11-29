import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table"
import { useStorage } from "hooks/useStorage"

export function useTableState<TData extends RowData>(
  name: string,
  columns: ColumnDef<TData>[],
  defaultSort: SortingState
) {
  const sessionStorageKey = `FinSpotter::${name}:RowSelection`
  const { getItem, setItem, clear } = useStorage("session")
  const [rowSelection, setRowSelectionState] = useState<RowSelectionState>(
    () => getItem<RowSelectionState>(sessionStorageKey) ?? {}
  )
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const page = parseInt(params.get("page") ?? "1") - 1
  const offset = parseInt(params.get("offset") ?? "12")
  const sorting =
    splitSortString(params.get("sort"))?.filter((sort) =>
      columns
        .map((column) =>
          "accessorKey" in column ? column.accessorKey : column.id
        )
        .includes(sort.id)
    ) ?? defaultSort
  const columnFilters =
    splitFilterString(params.get("filter"))?.filter((filter) =>
      columns
        .map((column) =>
          "accessorKey" in column ? column.accessorKey : column.id
        )
        .includes(filter.id)
    ) ?? []
  const pagination = { pageIndex: page, pageSize: offset }
  //TODO: something going on with toggling default sort column?
  const setSorting = (updater: Updater<SortingState>) => {
    if (!sorting) return
    const sort = updater instanceof Function ? updater(sorting) : updater
    const updatedParams = new URLSearchParams(params.toString())
    console.debug(`set sort ${sort}`)
    if (isNotDefaultSort(sort, defaultSort) && sort.length !== 0) {
      updatedParams.set(
        "sort",
        `${sort.map(({ id, desc }) => `${id}:${desc ? "desc" : "asc"}`).join(";")}`
      )
      router.push(pathname + "?" + updatedParams.toString())
    } else {
      updatedParams.delete("sort")
      router.push(pathname + "?" + updatedParams.toString())
    }
  }

  const setColumnFilters = (updater: Updater<ColumnFiltersState>) => {
    const filters =
      updater instanceof Function ? updater(columnFilters) : updater
    const updatedParams = new URLSearchParams(params.toString())
    if (filters.length) {
      updatedParams.set(
        "filter",
        `${filters.map(({ id, value }) => `${id}:${(value as string[]).join(",")}`).join(";")}`
      )
      router.push(pathname + "?" + updatedParams.toString())
    } else {
      updatedParams.delete("filter")
      router.push(pathname + "?" + updatedParams.toString())
    }
  }

  const setPagination = (updater: Updater<PaginationState>) => {
    const { pageIndex } =
      updater instanceof Function ? updater(pagination) : updater
    const updatedParams = new URLSearchParams(params.toString())
    if (pageIndex) {
      updatedParams.set("page", String(pageIndex + 1))
      router.push(pathname + "?" + updatedParams.toString())
    } else {
      updatedParams.delete("page")
      router.push(pathname + "?" + updatedParams.toString())
    }
  }

  const setRowSelection = (updater: Updater<RowSelectionState>) => {
    const newSelectionState =
      updater instanceof Function ? updater(rowSelection) : updater
    setItem(sessionStorageKey, newSelectionState)
    setRowSelectionState(updater)
  }

  //TODO: This only clears on soft nav, I want to clear rowSelection when navigating away also
  useEffect(() => {
    return () => {
      clear()
    }
  }, [clear])

  return {
    page,
    offset,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    pagination,
    setPagination,
    rowSelection,
    setRowSelection,
  }
}

function splitSortString(string: string | null) {
  return string
    ?.split(";")
    .map((sort) => sort?.split(":"))
    .map(([id, direction]) => ({ id, desc: direction === "desc" }))
}

function splitFilterString(string: string | null) {
  return string
    ?.split(";")
    .map((filter) => filter?.split(":"))
    .map(([id, value]) => {
      return { id, value: value.split(",") }
    })
}

function isNotDefaultSort(sort: SortingState, defaultSort: SortingState) {
  if (sort.length != defaultSort.length) return true
  return sort.some(
    ({ id, desc }, i) =>
      defaultSort[i].id !== id || defaultSort[i].desc !== desc
  )
}
