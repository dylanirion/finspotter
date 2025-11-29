import Link from "next/link"
import { species, type Species } from "@finspotter/config/species"
import { type Annotation } from "@finspotter/core/annotation"
import { createColumnHelper } from "@tanstack/react-table"
import { Badge } from "components/ui/badge/Badge"
import { Checkbox } from "components/ui/inputs/Checkbox"
import { SortableColumnHeader } from "components/ui/table/SortableColumnHeader"

const columnHelper = createColumnHelper<Annotation>()

export const columns = [
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center text-indigo-600">
        <Checkbox
          className="size-5 rounded-sm border bg-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:data-disabled:bg-gray-500 dark:border-slate-500 dark:bg-slate-700"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center text-indigo-600">
        <Checkbox
          className="size-5 rounded-sm border bg-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:data-disabled:bg-gray-500 dark:border-slate-500 dark:bg-slate-700"
          checked={row.getIsSelected()}
          onChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("id", {
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="ID" />
    ),
    cell: ({ getValue }) => {
      return (
        <div className="flex space-x-2 text-base whitespace-nowrap">
          <Link
            className="space-x-2 font-medium text-indigo-600 hover:text-indigo-700"
            href={`/admin/annotations/${getValue()}`}
          >
            {getValue().substring(0, 8)}
          </Link>
        </div>
      )
    },
  }),
  columnHelper.accessor((row) => row.mediaId, {
    id: "mediaId",
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Media" />
    ),
    cell: ({ getValue }) => {
      return (
        <div className="flex space-x-2 text-base whitespace-nowrap">
          <Link
            className="space-x-2 font-medium text-indigo-600 hover:text-indigo-700"
            href={`/admin/media/${getValue()}`}
          >
            {getValue().substring(0, 8)}
          </Link>
        </div>
      )
    },
  }),
  columnHelper.accessor((row) => row.category, {
    id: "category",
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Category" />
    ),
    cell: ({ getValue }) => {
      const category = getValue()
      return (
        <div className="text-base whitespace-nowrap">
          <span>
            {category ? species[category as Species].scientificName : "unknown"}
          </span>
        </div>
      )
    },
    meta: {
      filterVariant: "in",
    },
  }),
  columnHelper.accessor((row) => row.type, {
    id: "type",
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Type" />
    ),
    cell: ({ getValue }) => {
      const type = getValue()
      return (
        <div className="space-x-2 text-base whitespace-nowrap">
          {type &&
            type.split("$").map((type, i) => (
              <Badge key={i} variant="indigo">
                {type}
              </Badge>
            ))}
        </div>
      )
    },
    meta: {
      filterVariant: "fuzzyIn", //TODO: this doesn't really work, %bbox_xywh% would also match bbox_xywha
    },
  }),
  columnHelper.accessor((row) => row.source, {
    id: "source",
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Source" />
    ),
    cell: ({ getValue }) => {
      const source = getValue()
      return (
        <div className="text-base whitespace-nowrap">
          {source && <Badge variant="indigo">{source}</Badge>}
        </div>
      )
    },
  }),
]
