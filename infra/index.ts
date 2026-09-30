import {
  generateExports,
  type AnnotationPackage,
} from "@finspotter/annotations/init"
import { MediaProcessingPipeline } from "@finspotter/pipeline/MediaProcessingPipeline"
import { type PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"
import { SimilaritySearchPipeline } from "@finspotter/pipeline/SimilaritySearchPipeline"
import { SubmissionReviewPipeline } from "@finspotter/pipeline/SubmissionReviewPipeline"

import { db } from "./database"
import { domain } from "./domain"
import { email } from "./email"
import { gcpIdentityProvider, recaptcha } from "./gcp"
import { secret } from "./secret"
import { bucket } from "./storage"

export interface InfraConfig {
  pipeline?: PipelinePackage[]
  annotations?: AnnotationPackage[]
}

export function defineInfra({
  pipeline: packages = [],
  annotations = [],
}: InfraConfig = {}) {
  //generateExports(annotations)

  const submissionReview = new SubmissionReviewPipeline(
    "SubmissionReviewPipeline",
    {
      notificationEmail: secret.PipelineAlertsEmail.value,
    }
  )
  const pipeline = new MediaProcessingPipeline("MediaProcessingPipeline", {
    packages,
    bucket,
    table: submissionReview.table,
  })
  const similaritySearch = new SimilaritySearchPipeline(
    "SimilaritySearchPipeline",
    {
      packages,
      bucket,
      bus: submissionReview.bus,
      table: submissionReview.table,
    }
  )
  submissionReview.orchestrate(
    pipeline.stateMachine,
    similaritySearch.stateMachine,
    {
      searchFunction: similaritySearch.searchFunctions["faiss:pairwise"],
      refinements: [
        {
          functionName: similaritySearch.refineFunctions.ratio,
          config: { threshold: 0.625 },
        },
        {
          functionName: similaritySearch.refineFunctions.homog,
          config: { ransacReprojThreshold: 50 },
        },
        {
          functionName: similaritySearch.refineFunctions.sum,
          config: null,
        },
      ],
    }
  )

  const web = new sst.aws.Nextjs("Web", {
    domain,
    path: "./apps/web",
    openNextVersion: "4.1.5",
    link: [
      db,
      bucket,
      email,
      submissionReview,
      pipeline,
      similaritySearch,
      recaptcha,
      gcpIdentityProvider,
    ],
    environment: {
      BASE_URL: $dev ? `http://${domain}` : `https://${domain}`,
      BETTER_AUTH_SECRET: secret.BetterAuthSecret.value,
      BETTER_AUTH_URL: $dev ? `http://${domain}` : `https://${domain}`,
      // https://www.pulumi.com/registry/packages/gcp/api-docs/projects/apikey/
      //NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: secret.GoogleMapsApiKey.value,
      //NEXT_PUBLIC_GOOGLE_MAPS_API_MAPID: secret.GoogleMapsMapId.value,
      NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY: recaptcha.name,
      NEXT_PUBLIC_REALTIME_ENDPOINT: $interpolate`https://${submissionReview.realtime.dns.http}/event`,
      NEXT_PUBLIC_REALTIME_REGION: aws.getRegionOutput().name,
      NEXT_PUBLIC_IDENTITY_POOL: submissionReview.identityPool,
      ...($dev && {
        RUSTFS_ACCESS_KEY: process.env.RUSTFS_ACCESS_KEY,
        RUSTFS_SECRET_KEY: process.env.RUSTFS_SECRET_KEY,
      }),
    },
  })

  return {
    db,
    bucket,
    email,
    submissionReview,
    pipeline,
    similaritySearch,
    secret,
    web,
  }
}
