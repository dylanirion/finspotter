import { useCallback } from "react"
import { type Media } from "@finspotter/core/media"
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
import {
  ChevronDownIcon,
  Square3Stack3DIcon,
} from "@heroicons/react/24/outline"
import { createDetectionJob } from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { useTable } from "components/ui/table/TableProvider"

export function MediaActionMenu() {
  const { rowSelection } = useTable<Media>()
  const selectedMediaIds = Object.keys(rowSelection)

  const handleDetect = useCallback((mediaIds: string[]) => {
    createDetectionJob(mediaIds) //TODO: should this redirect to a live result page? or present a dialog with an option to
  }, [])

  return (
    <Menu>
      <MenuButton className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden">
        Actions
        <ChevronDownIcon
          className="-mr-1 ml-2 size-5 text-white"
          aria-hidden="true"
        />
      </MenuButton>
      <MenuItems
        className="w-[var(--button-width)] origin-top rounded-md bg-indigo-500 py-1 transition duration-100 ease-out [--anchor-gap:8px] data-closed:scale-95 data-closed:opacity-0"
        transition
        anchor="bottom"
      >
        {selectedMediaIds.length && (
          <MenuItem>
            <Button
              className="flex w-full cursor-pointer items-center p-1 data-focus:bg-indigo-600"
              onClick={() => handleDetect(selectedMediaIds)}
              intent="none"
            >
              <Square3Stack3DIcon className="mr-2 size-5" aria-hidden="true" />
              Detect
            </Button>
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  )
}
