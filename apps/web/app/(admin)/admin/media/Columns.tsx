import Link from "next/link"
import { species, toAcronym, type Species } from "@finspotter/config/species"
import { type Media } from "@finspotter/core/media"
import { createColumnHelper } from "@tanstack/react-table"
import { Badge, customBadgeVariants } from "components/ui/badge/Badge"
import { Checkbox } from "components/ui/inputs/Checkbox"
import { SortableColumnHeader } from "components/ui/table/SortableColumnHeader"
import { useMediaQuery } from "hooks/useMediaQuery"
import { humanReadableBytes, shortDateFormat } from "lib/utils"

const columnHelper = createColumnHelper<Media>()

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
            href={`/admin/media/${getValue()}`}
          >
            {getValue().substring(0, 8)}
          </Link>
        </div>
      )
    },
  }),
  columnHelper.accessor((row) => row.exif?.content_type, {
    id: "contentType",
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Content Type" />
    ),
    cell: ({ getValue }) => (
      <div className="text-base whitespace-nowrap">{getValue()}</div>
    ),
  }),
  columnHelper.accessor((row) => row.exif?.length, {
    id: "fileSize",
    //TODO: sorting by errors file_size: fileSize.value,
    //Also only seems to sort the n first ones?
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="File Size" />
    ),
    cell: ({ getValue }) => {
      const size = getValue()
      const formatted = size
        ? humanReadableBytes(Number(size), true)
        : undefined
      return <div className="text-base whitespace-nowrap">{formatted}</div>
    },
  }),
  columnHelper.accessor((row) => row.exif?.date_time, {
    id: "captureDate",
    //TODO: Might be more useful to query date and time separately?
    // Can't usefuly multi sort when this is actualy datetime
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Capture Date" />
    ),
    cell: ({ getValue }) => {
      const date = getValue()
      const formatted = date
        ? new Date(date).toLocaleDateString("en-US", shortDateFormat)
        : undefined
      return <div className="text-base whitespace-nowrap">{formatted}</div>
    },
  }),
  columnHelper.accessor("annotations", {
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Annotations" />
    ),
    cell: function CellComponent({ getValue }) {
      const isSmallScreen = useMediaQuery("(max-width: 768px)")
      const annotations = getValue()
      const annotationCounts =
        annotations?.reduce(
          (acc, annotation) =>
            acc.set(
              (annotation.category ?? "") || "unknown",
              (acc.get((annotation.category ?? "") || "unknown") ?? 0) + 1
            ),
          new Map<string, number>()
        ) ?? []

      //TODO: add reviewed? add annotation source?
      //TODO: add identity instead of species?
      return (
        <div className="space-x-2 text-base whitespace-nowrap">
          {Array.from(annotationCounts).map(([category, count]) => (
            <Badge
              key={category}
              variant={
                customBadgeVariants[
                  Object.keys(species).indexOf(category) %
                    customBadgeVariants.length
                ]
              }
            >
              {`${count > 1 ? count + "x " : ""} ${category === "unknown" ? (isSmallScreen ? "UNK" : category) : isSmallScreen ? toAcronym(species[category as Species].scientificName) : species[category as Species].scientificName}`}
            </Badge>
          ))}
        </div>
      )
    },
  }),
]
