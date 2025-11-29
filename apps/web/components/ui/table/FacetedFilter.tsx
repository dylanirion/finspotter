import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type ComponentType,
} from "react"
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react"
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { Badge } from "components/ui/badge/Badge"
import { Button } from "components/ui/inputs/Button"
import { cn } from "lib/utils"

import { useTable } from "./TableProvider"

//TODO: true/false selection https://github.com/sadmann7/shadcn-table/issues/216
//TODO: style from props or parent
interface Option {
  label: string
  value: string
  icon?: ComponentType<{ className?: string }>
}

interface FacetedFilterProps {
  className?: string
  column: string
  title?: string
  options: Option[]
}

export function FacetedFilter<TData>({
  className,
  column,
  title,
  options,
}: FacetedFilterProps) {
  const { table } = useTable<TData>()
  const col = table.getColumn(column)
  const facets = col?.getFacetedUniqueValues()
  const filterValues = col?.getFilterValue() as string[]
  const selectedValues = useMemo(() => new Set(filterValues), [filterValues]) // TODO: just use state with an Array?
  const [filter, setFilter] = useState("")

  const handleComboBoxChange = useCallback(
    (values: NoInfer<string[]>) => {
      if (values.filter((value) => value === null).length > 0) {
        selectedValues.clear()
        setFilter("")
      }
      selectedValues.clear()

      values.filter((value) => value === null).length === 0 &&
        values
          .filter((value) => value !== null)
          .forEach((value) => {
            selectedValues.add(value)
          })

      const filterValues = Array.from(selectedValues)
      col?.setFilterValue(filterValues.length ? filterValues : undefined)
    },
    [col, selectedValues]
  )
  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFilter(event.target.value),
    []
  )

  return (
    <Popover>
      <PopoverButton className={cn("relative px-1", className)}>
        <PlusIcon className="mr-1 size-4" />
        <span
          className={cn({
            "mr-1": selectedValues?.size > 0,
          })}
        >
          {title}
        </span>
        {selectedValues?.size > 0 && (
          <>
            <Badge className="rounded-md px-1 font-normal lg:hidden">
              {selectedValues.size}
            </Badge>
            <div className="hidden space-x-1 lg:flex">
              {selectedValues.size > 2 ? (
                <Badge className="rounded-md px-1 font-normal">
                  {selectedValues.size} selected
                </Badge>
              ) : (
                options
                  .filter((option) => selectedValues.has(option.value))
                  .map((option) => (
                    <Badge
                      key={option.value}
                      className="rounded-md px-1 font-normal"
                    >
                      {option.label}
                    </Badge>
                  ))
              )}
            </div>
          </>
        )}
      </PopoverButton>
      {/* TODO: get border and background color from parent, or prop? */}
      <PopoverPanel className="absolute z-10 mt-1 w-64 rounded-md border border-gray-300 bg-white px-1 shadow-md dark:border-slate-500 dark:bg-slate-900">
        <Combobox
          value={Array.from(selectedValues)}
          onChange={handleComboBoxChange}
          multiple
        >
          <div className="divide-y dark:divide-slate-500">
            <label className="flex text-gray-300 dark:bg-slate-900 dark:text-white">
              <span className="sr-only">Search</span>
              <span className="mr-1 flex items-center">
                <MagnifyingGlassIcon
                  className="block size-6"
                  aria-hidden="true"
                />
              </span>
              <ComboboxInput
                className="border-none p-1 outline-hidden focus:ring-0 focus:outline-hidden dark:bg-slate-900 dark:text-white"
                placeholder={title}
                onChange={handleInputChange}
                value={filter ?? ""}
              />
            </label>
            <ComboboxOptions className="mb-1" static>
              <div className="flex flex-col space-y-1 py-2">
                {options
                  .filter((option) =>
                    filter == ""
                      ? true
                      : option.label
                          .toLowerCase()
                          .includes(filter.toLowerCase())
                  )
                  .map((option, i) => (
                    <ComboboxOption
                      key={i}
                      className="group cursor-pointer opacity-50 select-none data-focus:bg-gray-100 data-focus:text-gray-500 data-selected:bg-gray-100 data-selected:text-gray-500"
                      value={option.value}
                    >
                      <div className={cn("flex items-center rounded-md px-1")}>
                        <div
                          className={cn(
                            "mr-2 inline-flex h-4 w-4 items-center justify-center rounded-sm border"
                          )}
                        >
                          <CheckIcon
                            className={cn(
                              "invisible h-4 w-4 group-data-selected:visible"
                            )}
                          />
                        </div>
                        {option.icon && <option.icon className="mr-2 size-4" />}
                        <span>{option.label}</span>
                        {facets?.get(option.value) && (
                          //TODO: show zero, but not when filtering?
                          <span className="ml-auto flex items-center justify-center font-mono text-xs">
                            {facets.get(option.value)}
                          </span>
                        )}
                      </div>
                    </ComboboxOption>
                  ))}
              </div>
              {selectedValues.size > 0 && (
                <ComboboxOption
                  className="cursor-pointer border-t py-1 text-center select-none data-focus:bg-gray-100 dark:border-slate-500"
                  value={null}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-md px-1"
                    )}
                  >
                    Clear Filter
                  </div>
                </ComboboxOption>
              )}
            </ComboboxOptions>
          </div>
        </Combobox>
      </PopoverPanel>
    </Popover>
  )
}

export function ResetButton<TData>(props: ComponentProps<"button">) {
  const { table } = useTable<TData>()
  const isFiltered = table.getState().columnFilters.length > 0

  const handleReset = useCallback(() => {
    table.resetColumnFilters()
  }, [table])

  if (!isFiltered) return

  return (
    <Button intent="none" onClick={handleReset} {...props}>
      Reset
      <XMarkIcon className="ml-2 size-4" />
    </Button>
  )
}
