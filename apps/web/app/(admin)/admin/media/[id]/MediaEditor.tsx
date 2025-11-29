"use client"

import { randomBytes } from "crypto"
import {
  memo,
  useCallback,
  useState,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react"
import { getImageProps } from "next/image"
import {
  AnnotationTypes,
  type AnnotationDataTypes,
  type AnnotationType,
} from "@finspotter/annotations"
import { getAnnotationComponents } from "@finspotter/annotations/react"
import { Canvas } from "@finspotter/canvas"
import { FiltersPanel, FiltersPopover } from "@finspotter/canvas/filter"
import { MediaLayer } from "@finspotter/canvas/media"
import { PanZoomPanel } from "@finspotter/canvas/pan-zoom"
import { species, toAcronym, type Species } from "@finspotter/config/species"
import { type Annotation } from "@finspotter/core/annotation"
//import { type Log } from "@next-finspotter/core/log"
import { type Media } from "@finspotter/core/media"
import {
  Field,
  Label,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Switch,
} from "@headlessui/react"
import { ChevronDownIcon } from "@heroicons/react/24/outline"
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutateAsyncFunction,
} from "@tanstack/react-query"
import {
  deleteAnnotation,
  insertAnnotations,
  updateAnnotation,
} from "app/_actions/annotations"
import { getSingleMedia } from "app/_actions/media"
import {
  humanReadableBytes,
  parseDate,
  shortDateFormat,
  twCols,
  type PartialBy,
} from "lib/utils"

export function MediaEditor({ id }: { id: string }) {
  //TODO: this needs to cache annotation infinitely, otherwise it refires on tab refocus
  const {
    data: { annotations = [], ...media },
  } = useQuery({
    queryKey: ["media", id],
    queryFn: async (): Promise<Media> => {
      const media = await getSingleMedia(id)
      if (!media) throw new Error("Media not found!")
      return media
    },
    initialData: {} as Media,
  })
  const [active, setActive] = useState<string[]>([])
  const queryClient = useQueryClient()

  const { mutateAsync: handleInsert } = useMutation({
    mutationFn: (variables: Annotation) => insertAnnotations([variables]),
    onSuccess: (result, variables) => {
      //If mysql had a returning insert, we could just queryClient.setQueryData()
      queryClient.invalidateQueries({
        queryKey: ["media", id],
        exact: true,
      })
      setActive([
        ...active.filter((id) => id !== variables.id),
        ...result.map(({ id }) => id).filter((id) => id !== undefined),
      ])
    },
  })

  const { mutateAsync: handleUpdate } = useMutation({
    mutationFn: (variables: Annotation) => updateAnnotation(variables),
    onSuccess: () => {
      //If mysql had a returning update, we could just queryClient.setQueryData()
      queryClient.invalidateQueries({
        queryKey: ["media", id],
        exact: true,
      })
    },
  })

  const { mutateAsync: handleDelete } = useMutation({
    mutationFn: (variables: Annotation) =>
      !variables.id.startsWith("$")
        ? deleteAnnotation(variables.id)
        : Promise.resolve(),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["media", id], (prev: Media) => ({
        ...prev,
        annotations: prev.annotations?.filter(
          (annotation) => annotation.id !== variables.id
        ),
      }))
      setActive(active.filter((id) => id !== variables.id))
    },
  })

  const { mutateAsync: setCategory } = useMutation({
    mutationFn: (_variables: { id: string; category: string | undefined }) =>
      Promise.resolve(),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["media", id], (prev: Media) => ({
        ...prev,
        annotations: prev.annotations?.map((annotation) =>
          annotation.id === variables.id
            ? { ...annotation, category: variables.category }
            : annotation
        ),
      }))
    },
  })

  const { mutateAsync: convertType } = useMutation({
    mutationFn: (_variables: {
      id: string
      type: AnnotationType | "null"
      data: Partial<AnnotationDataTypes[keyof AnnotationDataTypes]> | null
    }) => Promise.resolve(),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["media", id], (prev: Media) => ({
        ...prev,
        annotations: prev.annotations?.map((annotation) =>
          annotation.id === variables.id
            ? { ...annotation, type: variables.type, data: variables.data }
            : annotation
        ),
      }))
    },
  })

  const { mutateAsync: addNew } = useMutation({
    mutationFn: (_variables: {
      mediaId: string | number
      type: AnnotationType
    }) => Promise.resolve(),
    onSuccess: (_, variables) => {
      const tempAnnotationId = `$${randomBytes(10).toString("hex")}`
      queryClient.setQueryData(["media", id], (prev: Media) => {
        const newAnnotation = {
          id: tempAnnotationId,
          type: variables.type,
          source: "manual",
          mediaId: variables.mediaId,
        }
        return {
          ...prev,
          annotations: prev?.annotations
            ? [...prev.annotations, newAnnotation]
            : [newAnnotation],
        }
      })
      setActive((active) => [...active, tempAnnotationId])
    },
  })

  const { props: imgProps } = getImageProps({
    src: media.src,
    width: Number(media.exif?.width ?? 4000),
    height: Number(media.exif?.height ?? 3000),
    alt: "",
    quality: 100,
  })

  const optimizedMedia = {
    ...media,
    ...imgProps,
  }

  //TODO add instructions to user, circle icon?
  //TODO consider admin nav offset in breakpoints, can tailwind do arbitrary breakpoints?
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
      <Canvas
        key={id}
        id={id}
        className="col-span-1 max-h-[calc(100dvh-10rem)] justify-center rounded-md shadow-md md:col-span-3"
        width={media.exif?.width}
        height={media.exif?.height}
      >
        <MediaLayer media={optimizedMedia}>
          {/* TODO: save filter state to database with image? */}
          <FiltersPopover className="absolute top-1 left-1 size-8 rounded-md bg-slate-900">
            <FiltersPanel />
          </FiltersPopover>
          <PanZoomPanel className="absolute top-1 right-1" />
          {annotations.map((annotation, i) => {
            //TODO: use this as an actual hook and make it return a Map or something?
            //TODO: catch and toast unknown annotation type error
            const {
              AnnotationLayer,
              EditPanel,
              EditPopover,
              EditPanelButtons,
              convertTo,
            } = getAnnotationComponents(annotation.type ?? "null")
            const { Category, Save, Delete, Convert, ...buttons } =
              EditPanelButtons
            return (
              <AnnotationLayer
                key={annotation.id}
                index={i}
                active={active.includes(String(annotation.id))}
                annotation={annotation}
                style={{ color: twCols[i % twCols.length].hex }}
                editable={true}
              >
                <EditPopover>
                  <EditPanel setActive={setActive}>
                    <div className="flex flex-row items-center justify-between">
                      {Object.values(buttons).map((Button, i) => (
                        <Button key={i} />
                      ))}
                      <Save
                        updateAction={handleUpdate}
                        insertAction={handleInsert}
                      />
                      <Delete deleteAction={handleDelete} />
                      {convertTo && (
                        <Convert
                          convertActions={convertTo}
                          convertType={convertType}
                        />
                      )}
                    </div>
                    <Category setCategory={setCategory} />
                  </EditPanel>
                </EditPopover>
              </AnnotationLayer>
            )
          })}
        </MediaLayer>
      </Canvas>
      <div className="grid auto-cols-auto grid-flow-col gap-3 md:block md:space-y-3">
        <MediaMeta
          className="rounded-md border bg-white p-3 shadow-md dark:border-slate-600 dark:bg-slate-700"
          media={media}
        />
        <AnnotationSelector
          className="rounded-md border bg-white p-3 shadow-md dark:border-slate-600 dark:bg-slate-700"
          mediaId={id}
          annotations={annotations}
          active={active}
          setActive={setActive}
          addNew={addNew}
        />
        <Log className="rounded-md border bg-white p-3 shadow-md dark:border-slate-600 dark:bg-slate-700" />
      </div>
    </div>
  )
}

//TODO: button to re-read EXIF (see id 936)
const MediaMeta = memo(function MediaMeta({
  media,
  ...rest
}: ComponentProps<"div"> & { media: Pick<Media, "exif"> }) {
  return (
    <div {...rest}>
      <h1 className="text-xl font-bold tracking-tight">EXIF</h1>
      <ul className="list-none text-sm">
        {media.exif?.width && media.exif?.height && (
          <li>{`${media.exif.width}x${media.exif.height}`}</li>
        )}
        {media.exif?.length && (
          <li>{humanReadableBytes(Number(media.exif.length), true)}</li>
        )}
        {media.exif?.camera_make && media.exif?.camera_model && (
          <li>
            <span>{`${media.exif.camera_make} ${media.exif.camera_model}`}</span>
          </li>
        )}
        {media.exif?.date_time && (
          <li>
            {parseDate(media.exif.date_time).toLocaleDateString(
              "en-US",
              shortDateFormat
            )}
          </li>
        )}
      </ul>
    </div>
  )
})

//TODO: indicate unsaved/scratch, maybe this can come from react-query mutations?
function AnnotationSelector({
  mediaId,
  annotations,
  active,
  setActive,
  addNew,
  ...rest
}: Omit<ComponentProps<"div">, "id"> & {
  mediaId: string | number
  annotations: PartialBy<Annotation, "data">[]
  active: string[]
  setActive: Dispatch<SetStateAction<string[]>>
  addNew: UseMutateAsyncFunction<
    void,
    Error,
    {
      mediaId: string | number
      type: AnnotationType
    },
    unknown
  >
}) {
  //TODO: useContext for active and consume in Switch? prevents this rerendering
  const handleToggle = useCallback(
    (id: string) => {
      /*
    if (
      temporaryAnnotation &&
      !confirm("You have unsaved changes, do you wish to discard them?")
    )
      return
    setTemporaryAnnotation(undefined)
    */
      setActive((active) =>
        active.includes(id)
          ? active.filter((activeId) => activeId !== id)
          : [...active, id]
      )
    },
    [setActive]
  )

  const handleAddNew = useCallback(
    (type: AnnotationType) => {
      addNew({ mediaId, type })
    },
    [mediaId, addNew]
  )

  return (
    <div {...rest}>
      <h1 className="text-xl font-bold tracking-tight">Annotations</h1>
      <div className="mt-2 flex flex-col space-y-2">
        {annotations &&
          annotations.map(({ id, category, source, type }, i) => {
            const { Icon } = getAnnotationComponents(type ?? "null")
            return (
              <Field key={id}>
                <div className="flex items-center">
                  <Switch
                    checked={active.includes(id)}
                    onChange={() => handleToggle(id)}
                    className={`group relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full bg-gray-200 transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden ${twCols[i % twCols.length].bgChecked} dark:bg-slate-500`}
                  >
                    <span className="inline-block size-4 translate-x-1 rounded-full bg-white transition group-data-checked:translate-x-6" />
                  </Switch>
                  <Label className="ml-4">
                    <span
                      className={`${twCols[i % twCols.length].text}`}
                      title={
                        category
                          ? species[category as Species].scientificName
                          : "unknown"
                      }
                    >
                      {category
                        ? toAcronym(species[category as Species].scientificName)
                        : "unknown"}
                    </span>
                    {source && (
                      <span className="ml-2 inline-flex h-5 items-center space-x-1 rounded-full bg-blue-100 px-2.5 py-0.5 align-text-bottom text-xs font-medium text-blue-800">
                        {source}
                        {Icon && <Icon className="inline-flex size-6 px-1" />}
                      </span>
                    )}
                  </Label>
                </div>
              </Field>
            )
          })}
      </div>
      <Menu>
        <MenuButton className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden">
          Add New
          <ChevronDownIcon className="size-5 text-white/60" />
        </MenuButton>
        <MenuItems
          className="w-[var(--button-width)] origin-top rounded-md bg-indigo-500 py-1 transition duration-100 ease-out [--anchor-gap:8px] data-closed:scale-95 data-closed:opacity-0"
          transition
          anchor="bottom"
        >
          {AnnotationTypes.map((type, i) => (
            <MenuItem key={i}>
              <button
                className="flex w-full cursor-pointer p-1 data-focus:bg-indigo-600"
                onClick={() => handleAddNew(type)}
              >
                {type}
              </button>
            </MenuItem>
          ))}
        </MenuItems>
      </Menu>
    </div>
  )
}

function Log({ ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest}>
      <h1 className="text-xl font-bold tracking-tight">Log</h1>
      <ul className="list-none text-sm">
        <li>submitted from 192.168.1.1...</li>
      </ul>
    </div>
  )
}
