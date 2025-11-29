import { ComponentProps, useCallback } from "react"
import { type Where } from "@finspotter/core/database"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "lib/utils"

import { mapToFilterVariant, useTable } from "./TableProvider"

interface PaginationProps {
  maxButtons: number
}

//TODO: conditional rounding (if ring is present in className?)
export function TablePagination<TData>({
  className,
  maxButtons,
}: PaginationProps & ComponentProps<"ul">) {
  const { table, name, columns, queryFn, rowSelection, total, isLoading } =
    useTable<TData>()
  const {
    getPageCount,
    getCanPreviousPage,
    getCanNextPage,
    previousPage,
    nextPage,
    setPageIndex,
    getState,
  } = table
  const {
    pagination: { pageIndex, pageSize },
    sorting,
    columnFilters,
  } = getState()
  const pageCount = getPageCount()
  const showAllButtons = pageCount <= maxButtons
  const showHeadButtons = pageIndex < maxButtons - 3
  const showTailButtons = pageIndex > pageCount - 5
  const firstItem = pageIndex * pageSize + 1
  const lastItem = Math.min((pageIndex + 1) * pageSize, total)

  const queryClient = useQueryClient()

  const prefetch = useCallback(
    (page: number) => {
      queryClient.prefetchQuery({
        queryKey: [name, { page, offset: pageSize }, sorting, columnFilters],
        queryFn: (): Promise<{
          items: TData[]
          total: number
          facetCounts?: Record<string, Map<string, number>>
        }> =>
          queryFn({
            limit: pageSize,
            offset: page * pageSize,
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
                  [id]: mapToFilterVariant([unionValue], filterVariant),
                }))

                acc.or = [...orConditions]
              } else {
                acc[id as keyof typeof acc] = mapToFilterVariant(
                  value as string[],
                  filterVariant
                )
              }
              return acc
            }, {} as Where),
          }),
        staleTime: 60000,
      })
    },
    [name, columnFilters, sorting, columns, pageSize, queryClient, queryFn]
  )

  const renderPageButtons = () => {
    if (showAllButtons) {
      return Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
        <PageButton
          key={page}
          className={className}
          currentPage={pageIndex + 1}
          page={page}
          onMouseEnter={() => prefetch(page - 1)}
          onFocus={() => prefetch(page - 1)}
          onClick={() => setPageIndex(page - 1)}
        />
      ))
    }

    const buttons = []
    // always show page 1 (index 0)
    buttons.push(
      <PageButton
        key={1}
        className={className}
        currentPage={pageIndex + 1}
        page={1}
        onMouseEnter={() => prefetch(0)}
        onFocus={() => prefetch(0)}
        onClick={() => setPageIndex(0)}
      />
    )

    if (showHeadButtons) {
      for (let i = 2; i <= maxButtons - 2; i++) {
        buttons.push(
          <PageButton
            key={i}
            className={className}
            currentPage={pageIndex + 1}
            page={i}
            onMouseEnter={() => prefetch(i - 1)}
            onFocus={() => prefetch(i - 1)}
            onClick={() => setPageIndex(i - 1)}
          />
        )
      }
      buttons.push(<EllipsisButton key="ellipsis" className={className} />)
    } else if (showTailButtons) {
      buttons.push(<EllipsisButton key="ellipsis1" className={className} />)
      for (let i = pageCount - maxButtons + 3; i < pageCount; i++) {
        buttons.push(
          <PageButton
            key={i}
            className={className}
            currentPage={pageIndex + 1}
            page={i}
            onMouseEnter={() => prefetch(i - 1)}
            onFocus={() => prefetch(i - 1)}
            onClick={() => setPageIndex(i - 1)}
          />
        )
      }
    } else {
      buttons.push(<EllipsisButton key="ellipsis1" className={className} />)
      for (let i = pageIndex - 1; i <= pageIndex + 1; i++) {
        buttons.push(
          <PageButton
            key={i + 1}
            className={className}
            currentPage={pageIndex + 1}
            page={i + 1}
            onMouseEnter={() => prefetch(i)}
            onFocus={() => prefetch(i)}
            onClick={() => setPageIndex(i)}
          />
        )
      }
      buttons.push(<EllipsisButton key="ellipsis2" className={className} />)
    }
    // always show last page
    buttons.push(
      <PageButton
        key={pageCount}
        className={className}
        currentPage={pageIndex + 1}
        page={pageCount}
        onMouseEnter={() => prefetch(pageCount - 1)}
        onFocus={() => prefetch(pageCount - 1)}
        onClick={() => setPageIndex(pageCount - 1)}
      />
    )

    return buttons
  }

  return (
    <>
      {pageCount > 1 && (
        <nav className={cn("w-full sm:hidden")} aria-label="Pagination">
          <ul className="flex items-center justify-between">
            <li>
              <PaginationButton
                className={cn(className, "rounded-md")}
                onMouseEnter={() => prefetch(pageIndex - 1)}
                onFocus={() => prefetch(pageIndex - 1)}
                onClick={previousPage}
                disabled={!getCanPreviousPage()}
              >
                <span className="px-2">Previous</span>
              </PaginationButton>
            </li>
            <li>
              <PaginationButton
                className={cn(className, "rounded-md")}
                onMouseEnter={() => prefetch(pageIndex + 1)}
                onFocus={() => prefetch(pageIndex + 1)}
                onClick={nextPage}
                disabled={!getCanNextPage()}
              >
                <span className="px-2">Next</span>
              </PaginationButton>
            </li>
          </ul>
        </nav>
      )}
      <div
        className={cn(
          "hidden sm:flex sm:flex-1 sm:items-center sm:justify-between"
        )}
      >
        {!isLoading && !!total && (
          <div>
            <p className="text-sm">
              Showing <span className="font-medium">{firstItem}</span> to{" "}
              <span className="font-medium">{lastItem}</span> of{" "}
              <span className="font-medium">{total}</span> results
              {Object.entries(rowSelection).length > 0 && (
                <>
                  <span>, </span>
                  <span className="font-medium">
                    {Object.entries(rowSelection).length}
                  </span>
                  <span> selected</span>
                </>
              )}
            </p>
          </div>
        )}
        {pageCount > 1 && (
          <nav aria-label="Pagination">
            <ul className="isolate inline-flex -space-x-px rounded-md shadow-sm">
              <li>
                <PaginationButton
                  onMouseEnter={() => prefetch(pageIndex - 1)}
                  onFocus={() => prefetch(pageIndex - 1)}
                  onClick={previousPage}
                  disabled={!getCanPreviousPage()}
                  className={cn(className, "cursor-pointer rounded-l-md")}
                  aria-label="Previous"
                >
                  <ChevronLeftIcon className="size-5" aria-hidden="true" />
                </PaginationButton>
              </li>
              {renderPageButtons()}
              <li>
                <PaginationButton
                  onMouseEnter={() => prefetch(pageIndex + 1)}
                  onFocus={() => prefetch(pageIndex + 1)}
                  onClick={nextPage}
                  disabled={!getCanNextPage()}
                  className={cn(className, "cursor-pointer rounded-r-md")}
                  aria-label="Next"
                >
                  <ChevronRightIcon className="size-5" aria-hidden="true" />
                </PaginationButton>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </>
  )
}

function PageButton(
  props: {
    page: number
    currentPage: number
  } & ComponentProps<"button">
) {
  const { className, currentPage, page, ...rest } = props
  const isCurrentPage = currentPage === page
  return (
    <li>
      <PaginationButton
        className={cn(
          className,
          "cursor-pointer data-current:pointer-events-none data-current:z-10 data-current:bg-indigo-600 data-current:text-white data-current:ring-0 data-current:dark:bg-indigo-600"
        )}
        disabled={isCurrentPage}
        {...(isCurrentPage && { "data-current": true })}
        aria-current={isCurrentPage ? "page" : undefined}
        {...rest}
      >
        <span className="px-2">{page}</span>
      </PaginationButton>
    </li>
  )
}

function EllipsisButton({ className }: ComponentProps<"li">) {
  return (
    <li className={cn("pointer-events-none", className)}>
      <span className="px-2">...</span>
    </li>
  )
}

function PaginationButton(props: ComponentProps<"button">) {
  const { className, disabled, children, ...rest } = props
  return (
    <button
      className={cn(
        className,
        "relative focus:z-20 focus:outline-offset-0 disabled:pointer-events-none"
      )}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}
