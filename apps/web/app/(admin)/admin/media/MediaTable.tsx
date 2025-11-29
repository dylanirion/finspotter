"use client"

import { species } from "@finspotter/config/species"
import { type Media } from "@finspotter/core/media"
import { getAllMedia } from "app/_actions/media"
import { DataTable } from "components/ui/table/DataTable"
//import { FacetedFilter, ResetButton } from "components/ui/table/FacetedFilter"
import { TablePagination } from "components/ui/table/TablePagination"
import { TableProvider } from "components/ui/table/TableProvider"

import { columns } from "./Columns"
import { MediaActionMenu } from "./MediaActionMenu"

/*
const speciesOptions = Object.entries(species).map(([key, value]) => ({
  label: value.scientificName,
  value: key,
}))
*/

export function MediaTable() {
  return (
    <TableProvider<Media>
      name="Media"
      columns={columns}
      queryFn={getAllMedia}
      defaultSort={[{ id: "captureDate", desc: true }]}
    >
      <div className="space-y-3">
        <div className="mb-1 flex items-center justify-between space-x-2">
          <div className="flex justify-start space-x-2">
            {/* <FacetedFilter<Media>
              className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-gray-50 dark:border-slate-500 dark:bg-slate-700"
              column="annotations"
              title="Category"
              options={speciesOptions}
            />
            <ResetButton<Media> className="flex h-8 items-center px-2 lg:px-3" /> */}
          </div>
          <div className="flex justify-start space-x-2">
            <MediaActionMenu />
          </div>
        </div>
        <DataTable<Media> />
        <TablePagination<Media>
          className="bg-gray-50 p-2 text-sm font-semibold text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-300 dark:bg-slate-700 dark:ring-slate-500 dark:hover:bg-slate-600"
          maxButtons={7}
        />
      </div>
    </TableProvider>
  )
}
