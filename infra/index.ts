import {
  generateExports,
  type AnnotationPackage,
} from "@finspotter/annotations/init"
//import { MediaProcessingPipeline } from "@finspotter/pipeline/MediaProcessingPipeline"
import { type PipelinePackage } from "@finspotter/pipeline/MediaProcessingPipeline/PipelinePackage"

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

  /*
  new sst.x.DevCommand("ImageProxy", {
    link: [bucket],
    dev: {
      autostart: true,
      command: "tsx src/devImageProxy.ts",
    },
  })

  const pipeline = new MediaProcessingPipeline("MediaProcessingPipeline", {
    packages,
    bucket,
  })
  */

  const web = new sst.aws.Nextjs("Web", {
    domain,
    path: "./apps/web",
    openNextVersion: "4.1.0",
    link: [db, bucket, email, /*pipeline, */recaptcha, gcpIdentityProvider],
    environment: {
      BASE_URL: $dev ? `http://${domain}` : `https://${domain}`,
      BETTER_AUTH_SECRET: secret.BetterAuthSecret.value,
      BETTER_AUTH_URL: $dev ? `http://${domain}` : `https://${domain}`,
      // https://www.pulumi.com/registry/packages/gcp/api-docs/projects/apikey/
      //NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: secret.GoogleMapsApiKey.value,
      //NEXT_PUBLIC_GOOGLE_MAPS_API_MAPID: secret.GoogleMapsMapId.value,
      NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY: recaptcha.name,
      //NEXT_PUBLIC_REALTIME_ENDPOINT: $interpolate`https://${pipeline.realtime.dns.http}/event`,
      //NEXT_PUBLIC_REALTIME_REGION: aws.getRegionOutput().name,
      //NEXT_PUBLIC_IDENTITY_POOL: pipeline.identityPool,
    },
    transform: {
      assets: {
        transform: {
          bucket: (args, opts) => {
            args.bucket = bucket.name
            opts.id = bucket.name
          },
          policy: {},
        },
      },
    },
  })

  return { db, bucket, email, /*pipeline,*/ secret, web }
}
