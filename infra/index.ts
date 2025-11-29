import {
  generateExports,
  type AnnotationPackage,
} from "@finspotter/annotations/init"
import { ImageProcessingPipeline } from "@finspotter/pipeline/ImageProcessingPipeline"
import { PipelinePackage } from "@finspotter/pipeline/ImageProcessingPipeline/PipelinePackage"

import { db } from "./database"
import { domain } from "./domain"
import { email } from "./email"
import { gcpIdentityProvider, recaptcha } from "./gcp"
import { secret } from "./secret"
import { bucket } from "./storage"

export function init(
  pipelinePackages: PipelinePackage[],
  annotationPackages: AnnotationPackage[]
) {
  generateExports(annotationPackages)

  new sst.x.DevCommand("ImageProxy", {
    link: [bucket],
    dev: {
      autostart: true,
      command: "tsx src/devImageProxy.ts",
    },
  })

  const pipeline = new ImageProcessingPipeline("ImageProcessingPipeline", {
    packages: pipelinePackages,
    bucket: bucket,
  })

  const web = new sst.aws.Nextjs("Web", {
    domain,
    path: "./apps/web",
    openNextVersion: "3.8.5",
    link: [db, bucket, email, pipeline, recaptcha, gcpIdentityProvider],
    environment: {
      BASE_URL: $dev ? `http://${domain}` : `https://${domain}`,
      BETTER_AUTH_SECRET: secret.BetterAuthSecret.value,
      // https://www.pulumi.com/registry/packages/gcp/api-docs/projects/apikey/
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: secret.GoogleMapsApiKey.value,
      NEXT_PUBLIC_GOOGLE_MAPS_API_MAPID: secret.GoogleMapsMapId.value,
      NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY: recaptcha.name,
      NEXT_PUBLIC_REALTIME_ENDPOINT: $interpolate`https://${pipeline.realtime.dns.http}/event`,
      NEXT_PUBLIC_REALTIME_REGION: aws.getRegionOutput().name,
      NEXT_PUBLIC_IDENTITY_POOL: pipeline.identityPool,
    },
    transform: {
      assets: {
        transform: {
          bucket: (args, opts) => {
            args.bucket = bucket.id
            opts.id = bucket.id
          },
          policy: {},
        },
      },
    },
  })

  return { db, bucket, email, pipeline, secret, web }
}
