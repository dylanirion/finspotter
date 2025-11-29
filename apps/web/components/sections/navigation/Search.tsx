"use client"

import { useCallback, useRef } from "react"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { useMediaQuery } from "hooks/useMediaQuery"
import { cn } from "lib/utils"

//TODO need a solution to prevent search bar from pushing over other items on crowded menu
//maybe hide other menus on md instead of sm?
//TODO: make this a form and do intercepted/parallel route for results
export function Search() {
  const isSmallScreen = useMediaQuery("(max-width: 768px)")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const handleClick = useCallback(() => {
    inputRef.current && inputRef.current.focus({ preventScroll: true })
  }, [])

  return (
    <div className="relative mr-1 items-center justify-end">
      <label
        className="flex p-1 text-gray-300 hover:text-white"
        onClick={handleClick}
      >
        <span className="sr-only">Search</span>
        <span className="-mr-9 flex items-center pl-2">
          <MagnifyingGlassIcon className="block size-8" aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          className={cn(
            "h-10 w-10 transform rounded-full border-0 bg-transparent py-2 pr-3 pl-9 transition-all placeholder:text-gray-300 placeholder:italic focus:w-28 focus:border-2 focus:border-gray-300 focus:ring-0 focus:outline-hidden sm:focus:w-48"
          )}
          placeholder={isSmallScreen ? "Search" : "Search for anything..."}
          type="text"
          name="search"
        />
      </label>
    </div>
  )
}
