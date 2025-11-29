import Link from "next/link"
import { ArrowUpOnSquareIcon, ArrowUpTrayIcon } from "@heroicons/react/20/solid"
import { Button } from "components/ui/inputs/Button"
import { DropZone, DropZoneProps } from "components/ui/inputs/DropZone"
import { cn } from "lib/utils"

export function AboutDropZone({
  className,
  permittedTypes,
  onChange,
}: DropZoneProps) {
  return (
    <>
      <DropZone
        className={cn("group", className)}
        permittedTypes={permittedTypes}
        onChange={onChange}
      >
        {({ handleOpenFileInput }) => (
          <div className="flex w-full flex-col items-center gap-y-8 rounded-lg border-2 border-dashed border-gray-400 bg-white px-3 py-12 group-data-over:bg-gray-100 dark:bg-slate-700 group-data-over:dark:bg-slate-600">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              Drag & drop a photo
            </h2>
            <div className="flex size-24 items-center justify-center">
              <ArrowUpTrayIcon className="block size-full text-gray-500" />
            </div>
            <div className="flex w-full items-center">
              <div className="ml-4 grow border-t border-gray-400"></div>
              <span className="mx-4 shrink text-gray-400">Or</span>
              <div className="mr-4 grow border-t border-gray-400"></div>
            </div>
            <div className="flex items-center justify-center">
              <label onClick={handleOpenFileInput}>
                <Button
                  intent="primary"
                  size="large"
                  className="group relative flex cursor-pointer justify-center px-12 py-2 disabled:cursor-not-allowed"
                >
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <ArrowUpOnSquareIcon
                      className="size-5 text-indigo-500 group-hover:text-indigo-400"
                      aria-hidden="true"
                    />
                  </span>
                  Choose file
                </Button>
              </label>
            </div>
          </div>
        )}
      </DropZone>
      <div className="text-center text-sm text-slate-400">
        This site is protected by reCAPTCHA, the Google{" "}
        <Link
          className="text-indigo-600"
          href="https://policies.google.com/privacy"
        >
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link
          className="text-indigo-600"
          href="https://policies.google.com/terms"
        >
          Terms of Service
        </Link>{" "}
        apply.
      </div>
    </>
  )
}
