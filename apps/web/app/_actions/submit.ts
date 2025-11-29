"use server"

import { randomUUID } from "crypto"
import { parse } from "path"
import { headers } from "next/headers"
import { ALLOWEDCONTENTTYPES, site } from "@finspotter/config/site"
import { sendMail } from "@finspotter/core/email"
import { validateReCaptcha } from "@finspotter/core/recaptcha"
import { createStorageRepository } from "@finspotter/core/storage"
import { Template as VerifySubmission } from "@finspotter/email/templates/VerifySubmission"
import { invoke } from "@finspotter/pipeline/invoke"
import { type EncounterSubmissionData } from "app/(public)/submit/EncounterSubmissionReducer"
import {
  createEmailVerificationToken,
  createUserOnly,
  getSession,
} from "lib/auth"
import { splitBy } from "lib/utils"
import { extension } from "mime-types"
import { Resource } from "sst"

interface UserData {
  firstName?: string
  lastName?: string
  email?: string
  emailOthers?: string[] | string
}

const { getPresignedPostUrl, putItem, putItems, copyObject } =
  createStorageRepository()

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

  const pending = await copyMediaToPending(submissionId, encounters)
  const [images, videos] = splitBy(pending, ({ type }) =>
    type.startsWith("image/")
  )
  await addMediaToSubmissionTable(submissionId, images)
  await addMediaToSubmissionTableAsResult(submissionId, videos)
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

  //TODO just playing with this for now, function is almost identical to demo job
  //TODO this should only run if a default detection function & model exists or manual annotations have been provided

  return invoke<
    "yolact",
    "hesaff",
    "faiss:pairwise",
    ["ratio", "homog", "sum"]
  >({
    submissionId,
    payload: images.map(({ id, src }) => ({
      pk: submissionId,
      sk: `media#${id}`,
      media_id: id,
      bucket: Resource.UploadAssets.name,
      key: src,
    })),
    detect: {
      //TODO: get default detection function from database, if no detection function? - extract features on entire image? wait for bbox?
      functionName:
        Resource.ImageProcessingPipeline.detectionFunctions["yolact"],
      //TODO: get config from database
      config: {
        model: {
          bucket: Resource.UploadAssets.name,
          key: "_assets/yolact/weights/yolact_base_255_11000.pth",
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
        num_classes: 4 + 1,
        score_threshold: 0.5,
      },
    },
    extract: {
      functionName:
        Resource.ImageProcessingPipeline.extractionFunctions["hesaff"],
      config: { rotation_invariance: true },
    },
    search: {
      type: "pairwise",
      functionName:
        Resource.ImageProcessingPipeline.searchFunctions["faiss:pairwise"],
      config: null,
    },
    refine: [
      {
        functionName: Resource.ImageProcessingPipeline.refineFunctions["ratio"],
        config: { threshold: 0.625 },
      },
      {
        functionName: Resource.ImageProcessingPipeline.refineFunctions["homog"],
        config: { ransacReprojThreshold: 50 },
      },
      {
        functionName: Resource.ImageProcessingPipeline.refineFunctions["sum"],
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
  token?: string
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

  return await getPresignedPostUrl({
    bucket: Resource.UploadAssets.name,
    prefix: "_assets",
    key: "temp/daily/" + key + "." + extension(contentType),
    expiry: 300,
    contentType,
    contentLength,
  })
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

function copyMediaToPending(
  submissionId: string,
  encounters: Omit<EncounterSubmissionData, "presignedUrl" | "file" | "xhr">[]
) {
  return Promise.all(
    encounters.map(async (encounter) => {
      const { name, ext } = parse(encounter.src)
      const key = `_assets/pending/${submissionId}/${name}${ext}`
      await copyObject(
        `${Resource.UploadAssets.name}/_assets/${encounter.src}`,
        Resource.UploadAssets.name,
        key
      )
      return {
        ...encounter,
        src: key,
      }
    })
  )
}

function addMediaToSubmissionTable(
  submissionId: string,
  encounters: Omit<EncounterSubmissionData, "presignedUrl" | "file" | "xhr">[]
) {
  return putItems(
    Resource.ImageProcessingPipeline.table,
    encounters.map(({ id, src, type }) => ({
      pk: submissionId,
      sk: `media#${id}`,
      media_id: id,
      type,
      uri: { bucket: Resource.UploadAssets.name, key: src },
      gsi1pk: "result",
      created_at: new Date().toISOString(),
    }))
  )
}

function addMediaToSubmissionTableAsResult(
  submissionId: string,
  encounters: Omit<EncounterSubmissionData, "presignedUrl" | "file" | "xhr">[]
) {
  return putItems(
    Resource.ImageProcessingPipeline.table,
    encounters.map(({ id, src, type }) => ({
      pk: submissionId,
      sk: `media#${id}`,
      media_id: id,
      type,
      uri: { bucket: Resource.UploadAssets.name, key: src },
      gsi1pk: "result",
      final: true,
      created_at: new Date().toISOString(),
    }))
  )
}

function setStatusSubmitted(submissionId: string) {
  return putItem(Resource.ImageProcessingPipeline.table, {
    pk: submissionId,
    sk: "status",
    status: "submitted",
    created_at: new Date().toISOString(),
  })
}
