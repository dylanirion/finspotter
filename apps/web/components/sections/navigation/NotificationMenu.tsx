import { Fragment } from "react"
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import { BellIcon } from "@heroicons/react/24/outline"

//TODO keyboard focus on notification and user menus
export function NotificationMenu() {
  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        className="relative cursor-pointer rounded-full p-1 text-gray-300 hover:text-white focus:outline-hidden data-open:text-white"
      >
        <span className="sr-only">View notifications</span>
        <BellIcon className="size-8" aria-hidden="true" />
        {/* Example notification badge */}
        <span className="absolute top-1 right-0 inline-block size-2 rounded-full bg-red-500"></span>
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <PopoverPanel
          className="z-40 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:8px] dark:bg-slate-700"
          anchor="bottom end"
        >
          <div className="flex px-2">No notifications</div>
        </PopoverPanel>
      </Transition>
    </Popover>
  )
}
