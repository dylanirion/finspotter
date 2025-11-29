import React, { memo, useCallback, useState, type ReactNode } from "react"
import { ALLOWEDCONTENTTYPES } from "@finspotter/config/site"
import { PlusCircleIcon, PlusIcon } from "@heroicons/react/24/outline"
import { APIProvider } from "@vis.gl/react-google-maps"
import { Card } from "components/ui/card/Card"
import { Button } from "components/ui/inputs/Button"
import { DropZone } from "components/ui/inputs/DropZone"
import { cn } from "lib/utils"

import { EncounterSubmissionCard } from "./EncounterSubmissionCard"
import {
  fileListToEncounterSubmissionData,
  useSubmission,
} from "./EncounterSubmissionContext"
import {
  ActionTypes,
  type EncounterSubmissionData,
} from "./EncounterSubmissionReducer"
import { MapDialog } from "./MapDialog"

const permittedTypes = ["text/plain"] // Could allow files here too?

function ReorderTarget({
  id,
  onDrop,
  children,
}: {
  id?: number | string
  onDrop: (dropId: number | string | undefined) => void
  children?:
    | ReactNode
    | (({
        handleOpenFileInput,
      }: {
        handleOpenFileInput: () => void
      }) => ReactNode)
}) {
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
    },
    [submissionId, dispatch, handleGetRecaptchaToken]
  )

  return (
    <DropZone
      className={cn("group h-full w-2")}
      permittedTypes={permittedTypes}
      multiple={false}
      onDrop={() => onDrop(id)}
      onChange={(e) => handlePrepCardData([...(e.target.files ?? [])])}
    >
      {children}
    </DropZone>
  )
}

const AddTarget = memo(function AddTarget({
  children,
}: {
  children:
    | ReactNode
    | (({
        handleOpenFileInput,
      }: {
        handleOpenFileInput: () => void
      }) => ReactNode)
}) {
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
    },
    [submissionId, dispatch, handleGetRecaptchaToken]
  )

  return (
    <DropZone
      className="group h-full"
      permittedTypes={ALLOWEDCONTENTTYPES}
      multiple={true}
      onChange={(e) => handlePrepCardData([...(e.target.files ?? [])])}
    >
      {children}
    </DropZone>
  )
})
AddTarget.displayName = "AddTarget"

export function AddMetadataStep({ title }: { title: string }) {
  const _title = title
  const { data, dispatch } = useSubmission()
  const [dragId, setDragId] = useState<number | string | null>(null)
  const [mapId, setMapId] = useState<number | string | null>(null)

  const reorder = useCallback(
    (dropId: number | string | undefined) => {
      if (dragId === null || dropId === null) return
      dispatch({
        type: ActionTypes.REORDER,
        payload: {
          id: dragId,
          insertBefore: dropId,
        },
      })
      setDragId(null)
    },
    [dragId, dispatch]
  )

  return (
    <>
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
        <MapDialog key={mapId} mapId={mapId} setMapId={setMapId} />
      </APIProvider>

      <div className="flex flex-wrap place-content-center">
        {data.map((datum: EncounterSubmissionData, i: number) => (
          <div className="flex pt-3" key={datum.id}>
            <ReorderTarget id={datum.id!} onDrop={reorder}>
              <div className="hidden h-full group-data-over:block">
                <div className="m-0.5 h-2/5 bg-indigo-600"></div>
                <div className="-mx-1 flex h-1/5 items-center justify-center text-indigo-600">
                  <PlusIcon className="size-4" />
                </div>
                <div className="m-0.5 h-2/5 bg-indigo-600"></div>
              </div>
            </ReorderTarget>
            <EncounterSubmissionCard
              tabIndex={i}
              data={datum}
              setDragId={setDragId}
              setMapId={setMapId}
            />
          </div>
        ))}
        <div className="pt-3">
          <ReorderTarget onDrop={reorder}>
            <div className="hidden h-full group-data-over:block">
              <div className="m-0.5 h-2/5 bg-indigo-600"></div>
              <div className="-mx-1 flex h-1/5 items-center justify-center text-indigo-600">
                <PlusIcon className="size-4" />
              </div>
              <div className="m-0.5 h-2/5 bg-indigo-600"></div>
            </div>
          </ReorderTarget>
        </div>
        <div className="pt-3">
          <AddTarget>
            {({ handleOpenFileInput }) => (
              <Card className="mx-1 flex h-full w-48 items-center justify-center border-none shadow-none group-data-over:border-4 group-data-over:border-dashed group-data-over:border-gray-200 group-data-over:dark:border-gray-500">
                <label onClick={handleOpenFileInput}>
                  <Button intent="none" className="cursor-pointer">
                    <PlusCircleIcon className="size-16 text-gray-200 dark:text-gray-500" />
                  </Button>
                </label>
              </Card>
            )}
          </AddTarget>
        </div>
      </div>
    </>
  )
}
