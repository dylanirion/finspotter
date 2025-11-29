"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { species } from "@finspotter/config/species"
import { type IndividualSummary } from "@finspotter/core/individual"
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { PhotoIcon, TableCellsIcon } from "@heroicons/react/24/solid"
import { getAllIndividuals } from "app/_actions/individuals"
import { DataTable } from "components/ui/table/DataTable"
import { FacetedFilter, ResetButton } from "components/ui/table/FacetedFilter"
import { TablePagination } from "components/ui/table/TablePagination"
import { TableProvider } from "components/ui/table/TableProvider"
import { TextFilter } from "components/ui/table/TextFilter"

import { columns } from "./Columns"
import { DataGrid } from "./DataGrid"

const speciesOptions = Object.entries(species).map(([key, value]) => ({
  label: value.scientificName,
  value: key,
}))

export function IndividualsTabPanel() {
  const tabs = useMemo(() => ["table", "grid"], [])
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get("tab")
  const validTab = isValidTab(tab) ? tab : tabs[0]
  const tabIndex = tabs.indexOf(validTab)

  const setTab = useCallback(
    (index: number) => {
      const updatedParams = new URLSearchParams(params.toString())
      if (index != 0) {
        updatedParams.set("tab", tabs[index])
        router.push(pathname + "?" + updatedParams.toString())
      } else {
        updatedParams.delete("tab")
        router.push(pathname + "?" + updatedParams.toString())
      }
    },
    [params, pathname, router, tabs]
  )

  //TODO: keyboard tab focus outline on tab.list?
  return (
    <TableProvider<IndividualSummary>
      name="Individuals"
      columns={columns}
      queryFn={getAllIndividuals}
      defaultSort={[{ id: "lastSeen", desc: true }]}
    >
      <div className="container mx-auto space-y-3">
        <TabGroup selectedIndex={tabIndex} onChange={setTab}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center justify-start space-x-2">
              <TextFilter<IndividualSummary>
                className="h-8 w-[150px] rounded-md border border-gray-300 p-1 py-[0.4375rem] placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden lg:w-[250px] dark:border-slate-500 dark:bg-slate-700"
                column="id"
                placeholder="Filter individuals..."
              />
              <FacetedFilter<IndividualSummary>
                className="inline-flex h-8 cursor-pointer items-center rounded-md border border-gray-300 bg-gray-50 dark:border-slate-500 dark:bg-slate-700"
                column="species"
                title="Species"
                options={speciesOptions}
              />
              <ResetButton<IndividualSummary> className="flex h-8 cursor-pointer items-center px-2 lg:px-3" />
            </div>
            <div className="flex items-center justify-end">
              <TabList className="flex space-x-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-500">
                <Tab
                  id="tableTab"
                  className="group flex items-center rounded-md p-2 py-[0.4375rem] text-sm font-semibold focus:outline-hidden data-selected:bg-white data-selected:fill-sky-500 data-selected:shadow lg:pr-3 data-selected:dark:bg-slate-700 [&:not([data-selected])]:cursor-pointer"
                >
                  <>
                    <TableCellsIcon
                      className="size-5 group-data-selected:fill-sky-500"
                      aria-hidden="true"
                    />
                    <span className="sr-only lg:not-sr-only lg:ml-2">
                      Table
                    </span>
                  </>
                </Tab>
                <Tab
                  id="imageGridTab"
                  className="group flex items-center rounded-md p-2 py-[0.4375rem] text-sm font-semibold focus:outline-hidden data-selected:bg-white data-selected:fill-sky-500 data-selected:shadow lg:pr-3 data-selected:dark:bg-slate-700 [&:not([data-selected])]:cursor-pointer"
                >
                  <>
                    <PhotoIcon
                      className="size-5 group-data-selected:fill-sky-500"
                      aria-hidden="true"
                    />
                    <span className="sr-only lg:not-sr-only lg:ml-2">
                      Images
                    </span>
                  </>
                </Tab>
              </TabList>
            </div>
          </div>
          <TabPanels>
            <TabPanel id="tablePanel">
              <DataTable<IndividualSummary> />
            </TabPanel>
            <TabPanel id="imageGridPanel">
              <DataGrid />
            </TabPanel>
          </TabPanels>
        </TabGroup>
        <TablePagination<IndividualSummary>
          className="bg-gray-50 p-2 text-sm font-semibold text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-300 dark:bg-slate-700 dark:ring-slate-500 dark:hover:bg-slate-600"
          maxButtons={7}
        />
      </div>
    </TableProvider>
  )
}

function isValidTab(tab: string | null): tab is "table" | "grid" {
  return tab === "table" || tab === "grid"
}
