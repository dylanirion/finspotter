"use server"

import { randomUUID } from "crypto"
import { parse } from "path"
import { headers } from "next/headers"
import { ALLOWEDCONTENTTYPES, site } from "@finspotter/config/site"
import { sendMail } from "@finspotter/core/email"
import { createPipelineLifecycleRepository } from "@finspotter/core/pipeline"
import { validateReCaptcha } from "@finspotter/core/recaptcha"
import { createStorageRepository } from "@finspotter/core/storage"
import { Template as VerifySubmission } from "@finspotter/email/templates/VerifySubmission"
import { invoke, invokeMediaProcessing } from "@finspotter/pipeline/invoke"
import { type EncounterSubmissionData } from "app/(public)/submit/EncounterSubmissionReducer"
import {
  createEmailVerificationToken,
  createUserOnly,
  getSession,
} from "lib/auth"
import { extension } from "mime-types"
import { Resource } from "sst"

interface UserData {
  firstName?: string
  lastName?: string
  email?: string
  emailOthers?: string[] | string
}

const { getPresignedPostUrl, putItem, copyObject } =
  createStorageRepository()
const lifecycle = createPipelineLifecycleRepository({
  table: Resource.SubmissionReviewPipeline.table,
})

export async function doSubmission({
  submissionId,
  encounters,
  formData,
}: {
  submissionId: string
  encounters: Omit<EncounterSubmissionData, "presignedUrl" | "file" | "xhr">[]
  formData?: FormData
}) {
  const session = await getSession({ headers: await headers() })
  //TODO check permissions? technically want anyone to be able to submit

  const { firstName, lastName, email, emailOthers } = formData
    ? (Object.fromEntries(formData) as UserData)
    : {}

  //TODO: make step function fail more gracefully - skip if can't find image or error
  //TODO: add dynamo entry for submssion meta
  //TODO: add dynamo entry for submitter/subscriber info
  // -- think about possiblity for collision when verification happens during review?
  //TODO: add dynamo entry for exif, image meta
  //TODO: automate clustering to indexed search?

  console.debug(encounters, formData)

  await lifecycle.closeSubmission(
    submissionId,
    encounters.map(({ id }) => id)
  )
  await setStatusSubmitted(submissionId)

  //TODO: process videos (HLS, DASH?)

  // unauthenticated submission
  if (!session && email) {
    await createUserAndVerify({
      submissionId,
      email,
      firstName,
      lastName,
      subject: `Verify Your Submission to ${site.title}`,
    })
  }

  for (const email of Array.isArray(emailOthers)
    ? emailOthers
    : [emailOthers]) {
    await createUserAndVerify({
      submissionId,
      email,
      subject: `Verify Your Email Address for ${site.title}`,
    })
  }

  return invoke<
    undefined,
    undefined,
    "faiss:pairwise",
    ["ratio", "homog", "sum"]
  >({
    submissionId,
    payload: [],
    reconcileProcessing: true,
    search: {
      type: "pairwise",
      functionName:
        Resource.SimilaritySearchPipeline.searchFunctions["faiss:pairwise"],
      config: null,
    },
    refine: [
      {
        functionName: Resource.SimilaritySearchPipeline.refineFunctions["ratio"],
        config: { threshold: 0.625 },
      },
      {
        functionName: Resource.SimilaritySearchPipeline.refineFunctions["homog"],
        config: { ransacReprojThreshold: 50 },
      },
      {
        functionName: Resource.SimilaritySearchPipeline.refineFunctions["sum"],
        config: null,
      },
    ],
    expires: null,
  })
}

//TODO: this should awlays upload under pipelineId, but currently that comes from client in "key"
export async function getUploadUrl(
  contentType: string,
  contentLength: number,
  key: string = randomUUID(),
  token?: string,
  media?: {
    submissionId: string
    mediaId: string
  }
) {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) {
    if (!token) {
      throw new Error(
        "Unauthenticated request: user or reCAPTCHA token required."
      )
    }

    await validateReCaptcha(token)
  }

  if (contentLength > 262144000) {
    throw new Error(`${contentLength} exceeds content upload size limit`)
  }

  if (!ALLOWEDCONTENTTYPES.includes(contentType))
    throw new Error(
      `${contentType} is not configured as an allowed content type in @finspotter/config/site`
    )

  const upload = await getPresignedPostUrl({
    bucket: Resource.Uploads.name,
    prefix: "",
    key: "temp/daily/" + key + "." + extension(contentType),
    expiry: 300,
    contentType,
    contentLength,
  })

  if (media) {
    await lifecycle.registerSubmission(media.submissionId)
    await lifecycle.registerMedia({
      submissionId: media.submissionId,
      mediaId: media.mediaId,
      type: contentType,
      uri: { bucket: upload.bucket, key: upload.key },
    })
  }

  return upload
}

export async function completeMediaUpload({
  submissionId,
  mediaId,
}: {
  submissionId: string
  mediaId: string
}) {
  // TODO: bind upload completion to the user or upload capability.
  const media = await lifecycle.completeMediaUpload(submissionId, mediaId)
  const suffix = parse(media.uri.key).ext
  const pendingKey = `pending/${submissionId}/${mediaId}${suffix}`

  if (media.uri.key !== pendingKey) {
    await copyObject(
      `${media.uri.bucket}/${media.uri.key}`,
      media.uri.bucket,
      pendingKey
    )
    await lifecycle.setMediaUri(submissionId, mediaId, {
      bucket: media.uri.bucket,
      key: pendingKey,
    })
  }

  if (!media.type.startsWith("image/")) {
    await lifecycle.completeMediaProcessing(submissionId, mediaId)
    return
  }

  const detectionFunction =
    Resource.MediaProcessingPipeline.detectionFunctions["yolact"]
  const extractionFunction =
    Resource.MediaProcessingPipeline.extractionFunctions["hesaff"]
  if (!detectionFunction || !extractionFunction) {
    await lifecycle.completeMediaProcessing(
      submissionId,
      mediaId,
      "partially_succeeded"
    )
    return
  }

  const claimed = await lifecycle.claimMediaProcessing(submissionId, mediaId)
  if (!claimed) return

  try {
    const input = {
      submissionId,
      reportProgress: false,
      payload: [
        {
          pk: submissionId,
          sk: `media#${mediaId}`,
          media_id: mediaId,
          bucket: media.uri.bucket,
          key: pendingKey,
        },
      ],
      detect: {
        functionName: detectionFunction,
        config: {
          model: {
            bucket: Resource.Uploads.name,
            key: "assets/yolact/weights/yolact_base_255_11000.pth",
          },
          dataset: {
            class_names: [
              "haploblepharus_pictus",
              "haploblepharus_edwardsii",
              "poroderma_africanum",
              "poroderma_pantherinum",
            ],
            label_map: { 0: 1, 1: 2, 2: 3, 3: 4 },
          },
          num_classes: 5,
          score_threshold: 0.5,
        },
      },
      expires: null,
    }

    return await invokeMediaProcessing<"yolact", "hesaff">({
      ...input,
      extract: {
        functionName: extractionFunction,
        config: { rotation_invariance: true },
      },
    })
  } catch (error) {
    await lifecycle.failMediaProcessingStart(submissionId, mediaId)
    throw error
  }
}

async function createUserAndVerify(opts: {
  submissionId: string
  email?: string
  firstName?: string
  lastName?: string
  subject: string
}) {
  const { submissionId, email, firstName, lastName, subject } = opts
  if (!email) return
  return createUserOnly({
    body: {
      email,
      firstName,
      lastName,
    },
  })
    .then(async ({ user }) => ({
      user,
      token: await createEmailVerificationToken(user.email),
    }))
    .then(({ user, token }) =>
      sendMail(
        user.email,
        `${Resource.Email.from} <${Resource.Email.noreply}>`,
        subject,
        VerifySubmission({
          title: site.title,
          url: `${process.env.BASE_URL}/submit/${submissionId}?token=${token}`,
        })
      )
    )
}

function setStatusSubmitted(submissionId: string) {
  return putItem(Resource.SubmissionReviewPipeline.table, {
    pk: submissionId,
    sk: "status",
    status: "submitted",
    created_at: new Date().toISOString(),
  })
}
