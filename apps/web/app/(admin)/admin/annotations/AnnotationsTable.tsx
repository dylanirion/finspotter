"use client"

import { AnnotationTypes } from "@finspotter/annotations"
import { species } from "@finspotter/config/species"
import { type Annotation } from "@finspotter/core/annotation"
import { getAllAnnotations } from "app/_actions/annotations"
import { DataTable } from "components/ui/table/DataTable"
import { FacetedFilter, ResetButton } from "components/ui/table/FacetedFilter"
import { TablePagination } from "components/ui/table/TablePagination"
import { TableProvider } from "components/ui/table/TableProvider"

import { columns } from "./Columns"

const speciesOptions = Object.entries(species).map(([key, value]) => ({
  label: value.scientificName,
  value: key,
}))

const typeOptions = [
  ...new Set(AnnotationTypes.map((type) => type.split("$")).flat()),
].map((type) => ({
  label: type,
  value: type,
}))

export function AnnotationsTable() {
  return (
    <TableProvider<Annotation>
      name="Annotations"
      columns={columns}
      queryFn={getAllAnnotations}
      defaultSort={[{ id: "id", desc: false }]}
    >
      <div className="space-y-3">
        <div className="mb-1 flex items-center justify-between space-x-2">
          <div className="flex justify-start space-x-2">
            <FacetedFilter<Annotation>
              className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-gray-50 dark:border-slate-500 dark:bg-slate-700"
              column="category"
              title="Category"
              options={speciesOptions}
            />
            <FacetedFilter<Annotation>
              className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-gray-50 dark:border-slate-500 dark:bg-slate-700"
              column="type"
              title="Type"
              //TODO: add a "name" field to packages
              options={typeOptions}
            />
            <ResetButton<Annotation> className="flex h-8 items-center px-2 lg:px-3" />
          </div>
          {/*         
        <div className="flex justify-start space-x-2">
          <ActionMenu />
        </div>
        */}
        </div>
        <DataTable<Annotation> />
        <TablePagination<Annotation>
          className="bg-gray-50 p-2 text-sm font-semibold text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-300 dark:bg-slate-700 dark:ring-slate-500 dark:hover:bg-slate-600"
          maxButtons={7}
        />
      </div>
    </TableProvider>
  )
}
