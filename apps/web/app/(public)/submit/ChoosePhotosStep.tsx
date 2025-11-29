import { useCallback, useState } from "react"
import { ALLOWEDCONTENTTYPES } from "@finspotter/config/site"
import {
  ArrowUpOnSquareStackIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/20/solid"
import { Button } from "components/ui/inputs/Button"
import { DropZone } from "components/ui/inputs/DropZone"
import { GridSpinner } from "components/ui/spinners/GridSpinner"
import { Spinner } from "components/ui/spinners/Spinner"
import { cn } from "lib/utils"

import {
  fileListToEncounterSubmissionData,
  useSubmission,
} from "./EncounterSubmissionContext"
import { ActionTypes } from "./EncounterSubmissionReducer"

export function ChoosePhotosStep() {
  const [isLoading, setLoading] = useState(false)
  const { submissionId, dispatch, handleGetRecaptchaToken } = useSubmission()

  const handlePrepCardData = useCallback(
    async (fileList: File[]) => {
      dispatch({
        type: ActionTypes.ADD,
        payload: await fileListToEncounterSubmissionData(
          submissionId,
          fileList,
          handleGetRecaptchaToken
        ),
      })
      setLoading(false)
    },
    [submissionId, dispatch, handleGetRecaptchaToken]
  )

  return (
    <>
      <DropZone
        className="group flex items-center justify-center px-4 pt-14 sm:pt-6 lg:px-8"
        permittedTypes={ALLOWEDCONTENTTYPES}
        multiple={true}
        isDisabled={isLoading}
        onChange={(e) => handlePrepCardData([...(e.target.files ?? [])])}
      >
        {({ handleOpenFileInput }) => (
          <div className="flex w-full max-w-md flex-col gap-y-8 rounded-lg border-2 border-dashed border-gray-400 bg-white px-3 py-12 group-data-over:bg-gray-100 dark:bg-slate-700 group-data-over:dark:bg-slate-600">
            <>
              <h2 className="text-center text-3xl font-bold tracking-tight">
                Drag & drop some photos
              </h2>
              <div className="mx-auto flex size-24 items-center justify-center">
                {isLoading ? (
                  <GridSpinner className="block size-full text-gray-500" />
                ) : (
                  <ArrowUpTrayIcon className="block size-full text-gray-500" />
                )}
              </div>
              <div className="flex items-center">
                <div className="ml-4 grow border-t border-gray-400"></div>
                <span className="mx-4 shrink text-gray-400">Or</span>
                <div className="mr-4 grow border-t border-gray-400"></div>
              </div>
            </>
            <div className="flex items-center justify-center">
              <label
                className={cn({ "cursor-progress": isLoading })}
                onClick={handleOpenFileInput}
              >
                <Button
                  type="button"
                  intent="primary"
                  size="large"
                  className="group relative flex cursor-pointer justify-center px-12 py-2 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-2 pl-3">
                        <Spinner className="size-5 animate-spin text-indigo-400" />
                      </span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-2 pl-3">
                        <ArrowUpOnSquareStackIcon
                          className="size-5 text-indigo-500 group-hover:text-indigo-400"
                          aria-hidden="true"
                        />
                      </span>
                      Choose files
                    </>
                  )}
                </Button>
              </label>
            </div>
          </div>
        )}
      </DropZone>
    </>
  )
}
