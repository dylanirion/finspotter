"use client"

import { useCallback, useRef, type ChangeEvent } from "react"
import { type Annotation } from "@finspotter/core/annotation"
import { Button } from "components/ui/inputs/Button"
import { Spinner } from "components/ui/spinners/Spinner"
import toast, { CheckmarkIcon, ErrorIcon } from "react-hot-toast"

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    directory?: string
    webkitdirectory?: string
  }
}

export interface File {
  id: number
  file_name: string
  height: number
  width: number
  annotations: Annotation[]
}

//TODO: this should offer an output type and conversion method from COCO?
export function FileProcessor() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectDirectory = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target?.files) return
      const fileArray = [...e.target.files].filter(
        (file) => file.type === "application/json"
      )
      toast.promise(
        Promise.all(fileArray.map((file) => file.text()))
          .then((textArray) =>
            textArray.map((text) => JSON.parse(text) as File)
          )
          .then((fileArray) =>
            fileArray.reduce((acc, file) => {
              file.annotations.forEach((annotation) => {
                //TODO: check/destructure necessary properties?
                acc.push(annotation)
              })
              return acc
            }, [] as Annotation[])
          )
          /*
          //TODO: should this just be a server action?
          .then((annotations: Annotation[]) =>
            fetch(`/api/queue`, {
              method: "POST",
              headers: {
                "Content-type": "application/json",
              },
              body: JSON.stringify(
                annotations.map((annotation) => ({
                  type: "annotation",
                  data: annotation,
                }))
              ),
            })
          )
          .then((response) => {
            if (!response.ok) throw new Error(response.statusText)
          })
          */
          .finally(() => {
            e.target.value = ""
          }),
        {
          loading: "Processing...",
          success: "Complete!",
          error: "Something went wrong, please try again.",
        },
        {
          loading: {
            icon: <Spinner className="size-5 animate-spin text-indigo-400" />,
          },
          success: {
            icon: <CheckmarkIcon />,
          },
          error: {
            icon: <ErrorIcon />,
          },
        }
      )
    },
    []
  )

  const handleClick = useCallback(() => {
    if (!fileInputRef.current) return
    fileInputRef.current.click()
  }, [])

  return (
    <>
      <div className="w-96">
        <p className="mb-6 text-base text-gray-500 md:text-xl">
          Use this tool to import and queue annotations for review by selecting
          a directory of json files.
        </p>
        <Button
          className="group relative flex justify-center"
          intent="primary"
          size="medium"
          onClick={handleClick}
          fullWidth={true}
        >
          Select Directory
          <input
            className="hidden"
            ref={fileInputRef}
            type="file"
            webkitdirectory=""
            onChange={handleSelectDirectory}
          />
        </Button>
      </div>
    </>
  )
}
