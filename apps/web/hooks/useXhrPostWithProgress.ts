import { useCallback, useRef, useState } from "react"
import throttle from "lodash.throttle"

export function useXhrPostWithProgress() {
  const [progress, setProgress] = useState<
    { id: string | number; progress: number }[]
  >([])
  const uploadedFileList = useRef(new Map<string, string | undefined>())

  const post = useCallback(
    async (
      id: string,
      presignedUrl: Promise<
        | {
            url: string
            form: FormData
            bucket: string
            key: string
          }
        | undefined
      >,
      xhr: XMLHttpRequest,
      i: number,
      onUploaded?: () => Promise<unknown>
    ) => {
      uploadedFileList.current.set(id, undefined)
      const { url, form, key } = (await presignedUrl) ?? {}
      if (!form) throw new Error("Upload error: FormData is undefined")
      const size = getFormDataSize(form)

      return new Promise(function (resolve, reject) {
        //start upload
        if (!url) throw new Error("Upload error: url is undefined")
        setProgress((prev) => [...(prev ? prev : []), { id, progress: 0 }])
        xhr.open("POST", url, true)
        // update progress every 300ms
        xhr.upload.onprogress = throttle((event) => {
          if (event.lengthComputable) {
            setProgress((prev) =>
              prev.map((bytesObj) =>
                bytesObj.id === id
                  ? {
                      ...bytesObj,
                      progress: Math.min(
                        Math.round((event.loaded / size) * 100),
                        100
                      ),
                    }
                  : bytesObj
              )
            )
          }
        }, 300)
        xhr.onload = async () => {
          try {
            if (xhr.status < 200 || xhr.status >= 300) {
              throw new Error(`Upload failed with status ${xhr.status}`)
            }
            if (onUploaded) await retry(onUploaded, 3)
            uploadedFileList.current.set(id, key)
            setProgress((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, progress: 100 } : item
              )
            )
            resolve(id)
          } catch (error) {
            uploadedFileList.current.delete(id)
            setProgress((prev) =>
              prev.filter((bytesObj) => bytesObj.id !== id)
            )
            reject(error)
          }
        }
        xhr.onerror = () => {
          //unsetting could trigger endless upload attempts, maybe TODO: track & limit attempts?
          uploadedFileList.current.delete(id)
          setProgress((prev) => prev.filter((bytesObj) => bytesObj.id !== id))
          reject()
        }
        xhr.onabort = () => {
          uploadedFileList.current.delete(id)
          setProgress((prev) => prev.filter((bytesObj) => bytesObj.id !== id))
          resolve(id)
        }
        // stagger uploads
        setTimeout(() => xhr.send(form), i * 100)
      })
    },
    []
  )
  return { post, progress, uploadedFileList }
}

async function retry(action: () => Promise<unknown>, attempts: number) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await action()
    } catch (error) {
      if (attempt === attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
    }
  }
}

function getFormDataSize(form: FormData) {
  return [...form].reduce(
    (acc, [_field, value]) =>
      acc + (typeof value === "string" ? new Blob([value]).size : value.size),
    0
  )
}
