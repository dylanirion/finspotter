"use client"

import { Fold } from "components/sections/Fold"
import { Button } from "components/ui/inputs/Button"
import { SiteLogoError } from "components/ui/logos/SiteLogo"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error(error)

  return (
    <>
      <Fold className="relative flex w-full flex-row items-center justify-center gap-2">
        <Button
          intent="none"
          className="block h-64 w-auto border-none shadow-none"
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
        >
          <SiteLogoError className="size-full" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Error</h2>
          <p>Something went wrong, please try again.</p>
        </div>
      </Fold>
    </>
  )
}
