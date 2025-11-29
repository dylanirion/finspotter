import { memo, type PropsWithChildren } from "react"
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { AdjustmentsHorizontalIcon, SunIcon } from "@heroicons/react/24/outline"

import { useCanvas } from "./"
import { ContrastIcon } from "./icons/ContrastIcon"
import { useImage } from "./media"
import { cn } from "./utils"

export const FiltersPopover = memo(function FiltersPopover({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <Popover className="pointer-events-none">
      <PopoverButton
        className={cn(
          "pointer-events-auto cursor-pointer opacity-60 hover:opacity-75",
          className
        )}
      >
        <AdjustmentsHorizontalIcon className="block text-gray-300" />
      </PopoverButton>
      <PopoverPanel anchor="right start">{children}</PopoverPanel>
    </Popover>
  )
})
FiltersPopover.displayName = "FiltersPopover"

export function FiltersPanel() {
  const { brightness, contrast, handleBrightness, handleContrast } = useImage()
  const {
    canvasRef: { current: canvas },
  } = useCanvas()
  const ctx = canvas?.getContext("2d")

  if (!ctx?.filter) return

  //TODO: "wheel" effect with snap at 0
  return (
    <div className="pointer-events-auto ml-2 flex w-64 flex-col items-center justify-evenly rounded-md bg-white dark:bg-slate-700">
      <div className="flex w-full items-center">
        <SunIcon className="size-8 pr-1" />
        <input
          className="h-1 w-5/6 cursor-pointer appearance-none rounded-lg bg-gray-200"
          type="range"
          min="-100"
          max="100"
          defaultValue={brightness}
          step="1"
          onChange={handleBrightness}
        ></input>
      </div>
      <div className="flex w-full items-center">
        <ContrastIcon className="size-8 pr-1" />
        <input
          className="h-1 w-5/6 cursor-pointer appearance-none rounded-lg bg-gray-200"
          type="range"
          min="-100"
          max="100"
          defaultValue={contrast}
          step="1"
          onChange={handleContrast}
        ></input>
      </div>
    </div>
  )
}
