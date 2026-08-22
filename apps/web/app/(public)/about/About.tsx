"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import { type Media } from "@finspotter/core/media"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createDemoJob, getDetections, type Event } from "app/_actions/pipeline"
import { getUploadUrl } from "app/_actions/submit"
import { Fold } from "components/sections/Fold"
import { useCarouselApi } from "components/ui/carousel/Carousel"
import { useRealtime } from "hooks/useRealtime"
import { useSession } from "hooks/useSession"
import { nano } from "lib/utils"
import { customAlphabet } from "nanoid/non-secure"
import { useReCaptcha } from "next-recaptcha-v3"
import toast from "react-hot-toast"

import { AboutCanvas } from "./AboutCanvas"
import { AboutCarousel } from "./AboutCarousel"
import { AboutDropZone } from "./AboutDropZone"
import { DetectionFailedStep } from "./DetectionFailedStep"
import { DetectionResultStep } from "./DetectionResultStep"
import { DetectionStep } from "./DetectionStep"
import { SelectImageStep } from "./SelectImageStep"

const makeSubmissionId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21
)
//TODO: get this from config
const permittedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

type DemoMedia = Media & { file: File }

export const DemoContext = createContext<
  | {
      submissionId: string
    }
  | undefined
>(undefined)

export function About() {
  const queryClient = useQueryClient()
  const { connect, subscribe } = useRealtime()
  const [submissionId] = useState(makeSubmissionId)
  const [media, setMedia] = useState<DemoMedia | undefined>()
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const gotDetectionsRef = useRef(false)
  const { api } = useCarouselApi()
  const { executeRecaptcha } = useReCaptcha()
  const { data: session } = useSession()
  const user = session?.user

  useQuery(
    {
      queryKey: [submissionId, "detections"],
      queryFn: () => getDetections({ pk: submissionId }),
      staleTime: Infinity,
      initialData: [],
    },
    queryClient
  )

  const showingDropZone = api && (currentStep === 0 || currentStep === 2)

  const handleGetRecaptchaToken = useCallback(
    async (action: string) => {
      if (!executeRecaptcha || user) return
      try {
        return await executeRecaptcha(action)
      } catch (err) {
        console.error(err instanceof Error ? err.message : "reCAPTCHA is unavailable")
        toast.error("Something went wrong, please try again.", { id: "captcha-error" })
        return
      }
    },
    [executeRecaptcha, user]
  )

  const subscribeToRealtime = useCallback(async () => {
    await connect(`pipeline/${submissionId}`)
    gotDetectionsRef.current = false
    subscribe({
      next: (data: Event) => {
        console.debug("Pipeline: ", data.event)
        if (
          "invalidate" in data.event &&
          data.event.invalidate.startsWith("detection")
        ) {
          queryClient
            .invalidateQueries(
              {
                queryKey: [submissionId, "detections"],
                exact: true,
                refetchType: "active",
              },
              { throwOnError: true }
            )
            .then(() => {
              gotDetectionsRef.current = true
              api?.scrollTo(3)
            })
            .catch(() => {
              toast.error("Something went wrong, please try again.")
              api?.scrollTo(2)
            })
        }
        if ("status" in data.event && data.event.status === "failed") {
          if (!gotDetectionsRef.current) {
            api?.scrollTo(2)
          }
          toast.error("Something went wrong, please try again.")
        }
      },
      error: () => {
        toast.error("Something went wrong, please try again.")
        api?.scrollTo(2)
      },
    })
  }, [queryClient, api, connect, subscribe, submissionId])

  const handleProcessing = useCallback(
    async (file: DemoMedia) => {
      await subscribeToRealtime()
      const uploadToken = await handleGetRecaptchaToken("upload_demo_image")
      const { id, bucket, key } = await uploadImage(
        submissionId,
        file,
        uploadToken
      )
      const jobToken = await handleGetRecaptchaToken("create_demo_job")
      return createDemoJob({
        submissionId,
        mediaId: String(id),
        type: file.file.type,
        bucket,
        key: `_assets/${key}`,
        token: jobToken,
      })
    },
    [handleGetRecaptchaToken, subscribeToRealtime, submissionId]
  )

  const handleSelectImage = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !api || isProcessing) return
      setIsProcessing(true)
      const media = {
        id: await nano(file),
        file,
        src: URL.createObjectURL(file),
        annotations: [],
        exif: {},
      }
      setMedia(media)
      api.scrollTo(1)
      handleProcessing(media)
        .catch(() => {
          toast.error("Something went wrong, please try again.")
          api.scrollTo(2)
        })
        .finally(() => {
          e.target.value = ""
          setIsProcessing(false)
        })
    },
    [api, handleProcessing, isProcessing]
  )

  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrentStep(api.selectedScrollSnap())
    onSelect()
    api.on("select", onSelect)

    return () => {
      api.off("select", onSelect)
      queryClient.removeQueries({ queryKey: [submissionId] })
    }
  }, [api, queryClient, submissionId])

  const context = useMemo(
    () => ({
      submissionId,
    }),
    [submissionId]
  )

  return (
    <Fold className="flex flex-col items-center gap-2 lg:flex-row lg:gap-0">
      <DemoContext.Provider value={context}>
        <AboutCarousel>
          <SelectImageStep />
          <DetectionStep />
          <DetectionFailedStep />
          <DetectionResultStep />
        </AboutCarousel>
        <div className="h-96 w-full p-2 lg:h-full lg:w-1/2">
          {!showingDropZone ? (
            <AboutCanvas id={submissionId} media={media} />
          ) : (
            <>
              <AboutDropZone
                className="mx-auto flex w-full px-5 py-3 lg:w-2/3"
                permittedTypes={permittedTypes}
                onChange={handleSelectImage}
              />
            </>
          )}
        </div>
      </DemoContext.Provider>
    </Fold>
  )
}

export function useDemo() {
  const context = useContext(DemoContext)

  if (!context) {
    throw new Error("useDemo must be used inside the DemoProvider")
  }

  return context
}

async function uploadImage(
  submissionId: string,
  media: DemoMedia,
  token?: string
): Promise<{ id: string | number; bucket: string; key: string }> {
  const { bucket, key, url, fields } = await getUploadUrl(
    media.file.type,
    media.file.size,
    `${submissionId}/${media.id}`,
    token
  )
  const form = new FormData()
  Object.entries(fields).forEach(([field, value]) => {
    form.append(field, value)
  })
  form.append("file", media.file, key)
  const uploadResponse = await fetch(url, { method: "POST", body: form })
  if (!uploadResponse.ok) throw new Error(uploadResponse.statusText)
  return { id: media.id, bucket, key }
}
