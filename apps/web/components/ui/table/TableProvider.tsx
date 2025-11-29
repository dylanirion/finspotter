"use client"

import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react"
import {
  Sort,
  Where,
  type Equals,
  type FuzzyIn,
  type ILike,
  type In,
} from "@finspotter/core/database"
import { useQuery } from "@tanstack/react-query"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table"
import { cn } from "lib/utils"

import { useTableState } from "./useTableState"

export type FilterVariants = In | FuzzyIn | ILike | Equals

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- to match original declaration
  interface TableMeta<TData extends RowData> {
    facetCounts?: { [k: string]: Map<string, number> }
  }
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- to match original declaration
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: FilterVariants["operator"]
    union?: string[]
    hidden?: boolean
  }
}

interface TableProviderProps<TData extends RowData> {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  queryFn: ({
    limit,
    offset,
    where,
    sort,
  }: {
    limit: number
    offset: number
    where?: Where
    sort?: Sort
  }) => Promise<{
    items: TData[]
    total: number
    facetCounts?: Record<string, Map<string, number>>
  }>
  defaultSort: SortingState
}

export function TableProvider<TData extends { id: string | number }>({
  name,
  columns,
  queryFn,
  children,
  defaultSort,
}: PropsWithChildren<TableProviderProps<TData>>) {
  const {
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
  } = useTableState(name, columns, defaultSort)
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [name, { page, offset }, sorting, columnFilters],
    queryFn: (): Promise<{
      items: TData[]
      total: number
      facetCounts?: Record<string, Map<string, number>>
    }> =>
      queryFn({
        limit: offset,
        offset: page * offset,
        sort: sorting.map(({ id, desc }) => ({ [id]: { desc: desc } })),
        where: columnFilters?.reduce((acc, { id, value }) => {
          const column = columns.find((column) =>
            "accessorKey" in column
              ? column.accessorKey === id
              : column.id === id
          ) ?? { meta: { filterVariant: "like", union: undefined } }
          const { filterVariant, union } = column.meta ?? {}

          if (union) {
            const orConditions = union.map((unionValue) => ({
              [unionValue]: mapToFilterVariant(value, filterVariant),
            }))

            acc.or = [...orConditions]
          } else {
            acc[id as keyof typeof acc] = mapToFilterVariant(
              value,
              filterVariant
            )
          }
          return acc
        }, {} as Where),
      }),
  })

  const defaultData = useMemo<TData[]>(() => [], [])

  const table = useReactTable<TData>({
    data: data?.items ?? defaultData,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableSortingRemoval: false,
    state: {
      sorting,
      columnFilters,
      pagination,
      rowSelection,
      columnVisibility: columns.reduce((acc, column) => {
        if (column.meta?.hidden && "accessorKey" in column) {
          acc[column.accessorKey as string] = false
        }
        return acc
      }, {} as VisibilityState),
    },
    pageCount: data?.total ? Math.ceil(data.total / offset) : -1,
    meta: {
      facetCounts: data?.facetCounts,
    },
    getFacetedUniqueValues: (table, column) => () => {
      return (
        table.options.meta?.facetCounts?.[column] ?? new Map<string, number>()
      )
    },
  })

  const context = {
    table,
    name,
    columns,
    queryFn,
    rowSelection,
    total: data?.total ?? 0,
    isLoading,
    isFetching,
  } as TableContextProps<TData>

  return (
    <TableContext.Provider value={context}>
      <div
        className={cn({
          "cursor-wait [&_*]:cursor-wait": !isLoading && isFetching,
        })}
      >
        {children}
      </div>
    </TableContext.Provider>
  )
}

export interface TableContextProps<TData> {
  table: Table<TData>
  name: string
  columns: ColumnDef<TData>[]
  queryFn: ({
    limit,
    offset,
    sort,
    where,
  }: {
    limit: number
    offset: number
    sort?: Sort
    where?: Where
  }) => Promise<{ items: TData[]; total: number }>
  rowSelection: RowSelectionState
  total: number
  isLoading: boolean
  isFetching: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allow any table data
const TableContext = createContext<TableContextProps<any> | undefined>(
  undefined
)

export function useTable<TData>() {
  const context = useContext(TableContext)

  if (context === undefined) {
    throw new Error("useTable must be used inside a TableContext")
  }

  return context as TableContextProps<TData>
}

export function mapToFilterVariant(
  value: string[],
  variant: "eq" | "like" | "ilike" | "in" | "fuzzyIn" = "like"
): FilterVariants {
  switch (variant) {
    case "eq":
      return {
        operator: "eq",
        value: value[0],
      }
    case "ilike":
      return {
        operator: "ilike",
        value: value[0],
      }
    case "in":
      return {
        operator: "in",
        value,
      }
    case "fuzzyIn":
      return {
        operator: "in",
        value,
      }
    default:
      return {
        operator: "ilike",
        value: value[0],
      }
  }
}
