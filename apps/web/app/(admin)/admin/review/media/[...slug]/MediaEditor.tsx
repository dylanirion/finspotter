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
import { useParams } from "next/navigation"
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
import { getSingleMedia } from "app/_actions/pipeline"
import {
  humanReadableBytes,
  parseDate,
  shortDateFormat,
  twCols,
  type PartialBy,
} from "lib/utils"

//TODO: show existing annotations to replace
//TODO: on replace or new, save features
//TODO: on edit, trigger new features (can auto review if superuser)
export function MediaEditor({ id }: { id: string }) {
  const { slug: [mediaId, detectionId] = [] } = useParams<{ slug?: string[] }>()
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
  const queryClient = useQueryClient()

  //TODO: annotation updates/inserts should insert the original, and any modifications.
  const { mutateAsync: handleInsert } = useMutation({
    mutationFn: (variables: Annotation) => insertAnnotations([variables]),
    onSuccess: (result, variables) => {
      //If mysql had a returning insert, we could just queryClient.setQueryData()
      //TODO: these should actualy just use variables to setQueryData?
      queryClient.invalidateQueries({
        queryKey: ["media", id],
        exact: true,
      })
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
        className="col-span-1 max-h-[calc(100dvh_-_10rem)] justify-center rounded-md shadow-md md:col-span-3"
        width={media.exif?.width}
        height={media.exif?.height}
      >
        <MediaLayer media={optimizedMedia}>
          {/* TODO: save filter state to database with image? */}
          <FiltersPopover className="absolute top-1 left-1 size-8 rounded-md bg-slate-900">
            <FiltersPanel />
          </FiltersPopover>
          <PanZoomPanel className="absolute top-1 right-1" />
          {annotations
            .filter((annotation, i) => i == Number(detectionId))
            .map((annotation, i) => {
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
                  active={true}
                  annotation={annotation}
                  style={{ color: twCols[i % twCols.length].hex }}
                  editable={true}
                >
                  <EditPopover>
                    <EditPanel setActive={() => {}}>
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
      <div className="grid auto-cols-auto grid-flow-col gap-3 md:block md:space-y-3"></div>
    </div>
  )
}
