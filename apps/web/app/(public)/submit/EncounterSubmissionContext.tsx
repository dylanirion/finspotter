"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type DependencyList,
  type Dispatch,
  type PropsWithChildren,
  type RefObject,
} from "react"
import Link from "next/link"
import { getUploadUrl } from "app/_actions/submit"
import { SmallProgressBar } from "components/ui/spinners/SmallProgressBar"
import exifr from "exifr/dist/lite.esm.mjs"
import { useCustomEqualityEffect } from "hooks/useCustomEqualityEffect"
import { useSession } from "hooks/useSession"
import { useXhrPostWithProgress } from "hooks/useXhrPostWithProgress"
import { nano } from "lib/utils" //TODO: drop this or use it in place of uuid everywhere? mneumonic ids could be fun?
import { customAlphabet } from "nanoid/non-secure"
import { useReCaptcha } from "next-recaptcha-v3"
import toast from "react-hot-toast"

import {
  reducer,
  type EncounterSubmissionData,
  type PayloadTypes,
} from "./EncounterSubmissionReducer"

const makeSubmissionId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21
)

export const EncounterSubmissionContext = createContext<
  | {
      submissionId: string
      data: EncounterSubmissionData[]
      dispatch: Dispatch<PayloadTypes>
      handleGetRecaptchaToken: (action: string) => Promise<string | undefined>
      canSubmit: boolean
      uploadedFileList: RefObject<Map<string | number, string | undefined>>
    }
  | undefined
>(undefined)

export function EncounterSubmissionProvider({
  children,
}: PropsWithChildren<object>) {
  const { executeRecaptcha } = useReCaptcha()
  const [data, dispatch] = useReducer(reducer, [])
  const [submissionId] = useState(makeSubmissionId)
  const { post, progress, uploadedFileList } = useXhrPostWithProgress()
  const canSubmit = progress.every((item) => item.progress === 100) //TODO: can also check required fields (like user or email!)
  const { data: session } = useSession()
  const user = session?.user

  const handleGetRecaptchaToken = useCallback(
    async (action: string) => {
      if (!executeRecaptcha) return
      return !user ? await executeRecaptcha(action) : undefined
    },
    [executeRecaptcha, user]
  )

  const handleBackgroundUpload = useCallback(
    async (data: EncounterSubmissionData[]) =>
      Promise.all(
        data
          .filter((encounter) => !uploadedFileList.current.has(encounter.id))
          .map(async ({ id, presignedUrl, xhr }, i) =>
            post(id, presignedUrl, xhr, i)
          )
      ) /*
        .then((result) => {
          //TODO: in future, detection and extraction can be invoked here, accumulating results to finish on submission
        */
        .catch((error) => {
          //TODO: retry upload button?
          console.debug(error)
          toast.error("Something went wrong, please try again.")
        }),
    [post, uploadedFileList]
  )

  useCustomEqualityEffect(
    () => {
      data.length > 0 && handleBackgroundUpload(data)
    },
    [...data.map(({ id }) => id)],
    (a: DependencyList, b: DependencyList) =>
      a.length > 0 &&
      b.length > 0 &&
      a.every((val) => b.includes(val)) &&
      b.every((val) => a.includes(val))
  )

  useEffect(() => {
    progress.some((item) => item.progress !== 100) &&
      toast(
        <div className="flex flex-col">
          <div>Processing images...</div>
          <SmallProgressBar
            progress={
              progress.reduce((acc, { progress }) => acc + progress, 0) /
                progress.length || 0
            }
          />
        </div>,
        {
          id: "upload",
          duration: Infinity,
        }
      )
    return () => {
      toast.dismiss("upload")
    }
  }, [progress])

  const context = useMemo(
    () => ({
      submissionId,
      data,
      dispatch,
      handleGetRecaptchaToken,
      canSubmit,
      uploadedFileList,
    }),
    [
      submissionId,
      data,
      dispatch,
      canSubmit,
      uploadedFileList,
      handleGetRecaptchaToken,
    ]
  )

  return (
    <EncounterSubmissionContext.Provider value={context}>
      {children}
      {!user && (
        <div className="pt-14 text-center text-sm text-slate-400 sm:pt-6">
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
      )}
    </EncounterSubmissionContext.Provider>
  )
}

//TODO: save and load progress from local storage if present?
export function useSubmission() {
  const context = useContext(EncounterSubmissionContext)

  if (!context) {
    throw new Error(
      "useSubmission must be used inside the EncounterSubmissionProvider"
    )
  }

  return context
}

//TODO: filter to unique ids and maybe check if exists in s3 in upload function? will need to check size to allow overwriting a failed upload?
export function fileListToEncounterSubmissionData(
  submissionId: string,
  fileList: File[],
  getRecaptchaToken: (action: string) => Promise<string | undefined>
) {
  const response = fileList.map(async (file: File) => {
    const id = (await nano(file)) ?? file.name
    //TODO: https://github.com/mattiasw/ExifReader?
    const exif = await exifr.parse(file).catch(() => ({}))
    const token = await getRecaptchaToken(`upload_image`)
    const presignedUrl = getPresignedURL(submissionId, {
      id,
      file,
      token,
    }).catch(() => undefined)
    console.debug("parsed exif:", exif)
    return {
      id,
      file,
      src: URL.createObjectURL(file),
      type: file.type,
      dateTime:
        exif &&
        exif.DateTimeOriginal &&
        new Date(
          exif.DateTimeOriginal -
            exif.DateTimeOriginal.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, -8),
      location: exif && {
        gps: exif.latitude &&
          exif.longitude && {
            latitude: Math.round(exif.latitude * 100000) / 100000,
            longitude: Math.round(exif.longitude * 100000) / 100000,
          },
      },
      comment: file.name,
      xhr: new XMLHttpRequest(),
      presignedUrl,
    }
  })
  return Promise.all(response)
}

async function getPresignedURL(
  pipelineId: string,
  encounter: {
    id: string
    file: File
    token?: string
  }
) {
  const { bucket, key, url, fields } = await getUploadUrl(
    encounter.file.type,
    encounter.file.size,
    `${pipelineId}/${encounter.id}`,
    encounter.token
  ).catch((e) => {
    throw new Error(e)
  })
  const form = new FormData()
  Object.entries(fields).forEach(([field, value]) => {
    form.append(field, value)
  })
  form.append("file", encounter.file!, key)
  return {
    url,
    form,
    bucket,
    key,
  }
}
