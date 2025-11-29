import Link from "next/link"
import { species, toAcronym, type Species } from "@finspotter/config/species"
import { type IndividualSummary } from "@finspotter/core/individual"
import { createColumnHelper } from "@tanstack/react-table"
import { Badge } from "components/ui/badge/Badge"
import { SortableColumnHeader } from "components/ui/table/SortableColumnHeader"
import { useMediaQuery } from "hooks/useMediaQuery"
import { shortDateFormat } from "lib/utils"

const columnHelper = createColumnHelper<IndividualSummary>()

export const columns = [
  columnHelper.accessor("id", {
    header: () => (
      <div className="text-left text-sm font-medium uppercase">ID</div>
    ),
    cell: ({ row, getValue }) => {
      const id = getValue()
      const canonicalNames = row.original.canonicalNames
      const nickNames = row.original.nickNames
      return (
        <div className="flex space-x-2 text-base whitespace-nowrap">
          <Link
            className="space-x-2 font-medium text-indigo-600 hover:text-indigo-700"
            href={`/individuals/${id}`}
          >
            <div className="flex flex-col space-x-1">
              {canonicalNames &&
                canonicalNames.map((name) => <span key={name}>{name}</span>)}
            </div>
          </Link>
          {nickNames &&
            nickNames.map((name) => (
              //TODO: user chosen badge colours
              <Badge key={name} variant="indigo">
                {name}
              </Badge>
            ))}
        </div>
      )
    },
    meta: {
      union: ["canonicalNames", "nickNames"],
      filterVariant: "ilike",
    },
  }),
  columnHelper.accessor((row) => row.species, {
    id: "species",
    header: () => (
      <div className="text-left text-sm font-medium uppercase">Species</div>
    ),
    cell: function CellComponent({ getValue }) {
      const isSmallScreen = useMediaQuery("(max-width: 768px)")
      const category = getValue()

      return (
        <div className="text-base whitespace-nowrap">
          {category
            ? isSmallScreen
              ? toAcronym(species[category as Species].scientificName)
              : species[category as Species].scientificName
            : isSmallScreen
              ? "UNK"
              : "unknown"}
        </div>
      )
    },
    meta: {
      filterVariant: "in",
    },
  }),
  columnHelper.accessor((row) => row.totalEncounters, {
    id: "totalEncounters",
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Total Encounters" />
    ),
    cell: ({ getValue }) => (
      <div className="text-base whitespace-nowrap">{getValue()}</div>
    ),
  }),
  columnHelper.accessor((row) => row.lastSeen, {
    id: "lastSeen",
    header: ({ column }) => (
      <SortableColumnHeader column={column} header="Last Seen" />
    ),
    cell: ({ getValue }) => {
      const date = getValue()
      const formatted = date
        ? new Date(date).toLocaleDateString("en-US", shortDateFormat)
        : undefined
      return <div className="text-base whitespace-nowrap">{formatted}</div>
    },
  }),
]
