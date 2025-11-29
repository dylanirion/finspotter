import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from "react"
import Image from "next/image"
import {
  MagnifyingGlassPlusIcon,
  MapPinIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { XCircleIcon } from "@heroicons/react/24/solid"
import { Card } from "components/ui/card/Card"
import { Video } from "components/ui/images/Video"
import { Button } from "components/ui/inputs/Button"
import { useDebounce } from "hooks/useDebounce"
import { cn, rgbDataURL } from "lib/utils"

import { useSubmission } from "./EncounterSubmissionContext"
import {
  ActionTypes,
  type EncounterSubmissionData,
} from "./EncounterSubmissionReducer"

interface EncounterSubmissionCardProps {
  tabIndex: number
  data: EncounterSubmissionData
  setDragId: Dispatch<SetStateAction<number | string | null>>
  setMapId: Dispatch<SetStateAction<number | string | null>>
}

export function EncounterSubmissionCard({
  tabIndex,
  data,
  setDragId,
  setMapId,
}: EncounterSubmissionCardProps) {
  const { dispatch } = useSubmission()
  const [metaData, setMetaData] = useState({
    dateTime: data.dateTime,
    comment: data.comment,
  })
  const [isDragging, setDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (document) {
      document.body.style.overflow = "hidden"
    }
    setIsFullscreen(!isFullscreen)
  }

  const closeFullscreen = () => {
    if (document) {
      document.body.style.overflow = "auto"
    }
    setIsFullscreen(false)
  }

  const handleDragStart = () => {
    setDragging(true)
    setDragId(data?.id ?? null)
  }

  const handleDragEnd = () => {
    setDragging(false)
    setDragId(null)
  }

  const handleRemove = useCallback(
    (_e: MouseEvent) => {
      data.xhr.abort()
      dispatch({
        type: ActionTypes.REMOVE,
        payload: {
          id: data.id!,
        },
      })
    },
    [data.id, data.xhr, dispatch]
  )

  const debouncedUpdate = useDebounce(
    (id: number | string, key: string, value: string) => {
      dispatch({
        type: ActionTypes.UPDATE,
        payload: {
          id: id,
          data: {
            [key]: value,
          },
        },
      })
    },
    300
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target
      setMetaData((prev) => ({ ...prev, [name]: value }))
      debouncedUpdate(data.id!, name, value)
    },
    [data.id, debouncedUpdate]
  )

  const toggleMapDialog = useCallback(
    (e: MouseEvent<HTMLInputElement>) => {
      e.preventDefault
      setMapId(data.id!)
    },
    [data.id, setMapId]
  )

  const inputs = [
    {
      id: `${data.id}dateTime`,
      tag: <input />,
      type: "datetime-local",
      label: "Date",
      placeholder: "",
      value: metaData.dateTime,
      onChange: handleChange,
      autoComplete: "off",
    },
    {
      id: `${data.id}location`,
      tag: <input />,
      type: "text",
      label: "Location",
      placeholder: "Location",
      value:
        data.location?.name ??
        (data.location?.gps
          ? `${data.location.gps?.longitude}, ${data.location.gps?.latitude}`
          : undefined) ??
        "",
      onClick: toggleMapDialog,
      readOnly: true,
      autoComplete: "off",
      icon: (
        <MapPinIcon className="size-5 stroke-black px-0.5 dark:stroke-white" />
      ),
    },
  ]

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel()
    }
  }, [debouncedUpdate])

  //TODO: flippable card for extra info
  return (
    <>
      <Card
        className={cn(
          "group/card relative mx-1 flex shrink-0 grow-0 cursor-grab border-gray-100 bg-white px-2 text-left focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 focus-within:outline-hidden dark:border-gray-500 dark:bg-slate-700",
          {
            // TODO: chrome clips the dragImage (I think because of the ring offset)
            "opacity-50 ring-2 ring-indigo-500 ring-offset-2 outline-hidden":
              isDragging,
          }
        )}
        tabIndex={tabIndex}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Button intent="none" size="none" onClick={handleRemove}>
          <XCircleIcon className="absolute -top-2 -right-2 size-6 cursor-pointer fill-transparent group-hover/card:fill-red-600 group-focus/card:fill-red-600" />
        </Button>
        <div className="flex-col space-y-2">
          <div className="group/media relative aspect-[4/3]">
            {data.file.type.startsWith("video/") ? (
              <Video
                className="rounded object-cover object-center drop-shadow-md"
                src={data.src} // inaturalist uses blob then switches to s3 storage when uploaded
                draggable={false}
                controls
                fill
              />
            ) : (
              <>
                <Image
                  //using object-cover instead of contain until I can figure out how to do aspect other than 4/3
                  className="rounded object-cover object-center drop-shadow-md"
                  alt="Encounter image"
                  src={data.src} // inaturalist uses blob then switches to s3 storage when uploaded
                  draggable={false}
                  placeholder="blur"
                  blurDataURL={rgbDataURL(156, 163, 175)}
                  fill
                  unoptimized // remove this once we have a real url?
                  priority
                />
                <Button intent="none" size="none" onClick={toggleFullscreen}>
                  <MagnifyingGlassPlusIcon className="absolute right-0 bottom-0 size-6 cursor-pointer stroke-transparent group-hover/media:stroke-white" />
                </Button>
              </>
            )}
          </div>
          {inputs.map((input) => (
            <div key={input.id} className="relative">
              <label htmlFor={input.id} className="sr-only">
                {input.label}
              </label>
              <input
                id={input.id}
                name={input.id}
                type={input.type}
                className="block w-full appearance-none rounded-md border border-gray-300 bg-white p-1 shadow-sm placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-800"
                placeholder={input.placeholder}
                value={input.value ?? ""}
                onChange={input.onChange}
                onClick={input.onClick}
                readOnly={input.readOnly ?? false}
                autoComplete={input.autoComplete}
              />
              {input.icon && (
                <div
                  className="absolute inset-y-0 right-1 flex items-center"
                  onClick={input.onClick}
                >
                  {input.icon}
                </div>
              )}
            </div>
          ))}
          <div className="relative">
            <label htmlFor={data.id + "comment"} className="sr-only">
              Comment
            </label>
            <textarea
              id={data.id + "comment"}
              name="comment"
              className="block w-full resize-none appearance-none rounded-md border border-gray-300 p-1 shadow-sm placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-800"
              placeholder="Comment"
              value={metaData.comment ?? ""}
              onChange={handleChange}
              rows={2}
            />
          </div>
        </div>
      </Card>
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-black/85">
          <div className="aspect-[4/3]">
            <Image
              src={data.src}
              alt="Fullscreen encounter Image"
              className="object-contain"
              fill
              priority
            />
          </div>
          <Button
            intent="none"
            className="absolute top-4 right-4 cursor-pointer bg-transparent p-2 text-white focus:outline-hidden"
            onClick={closeFullscreen}
          >
            <XMarkIcon className="size-16 drop-shadow-lg" />
          </Button>
        </div>
      )}
    </>
  )
}
