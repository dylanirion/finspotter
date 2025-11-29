import { domain } from "./domain"

//TODO: SSL only
export const bucket = new aws.s3.BucketV2("UploadAssets", {
  bucket: `${$app.name}-${$app.stage}-uploadassets`,
})

new aws.s3.BucketCorsConfigurationV2("UploadAssetsCORS", {
  bucket: bucket.id,
  corsRules: [
    {
      allowedHeaders: ["*"],
      allowedMethods: ["POST", "PUT", "GET", "HEAD", "DELETE"],
      allowedOrigins: [$dev ? `http://${domain}` : `https://${domain}`],
      exposeHeaders: [],
      maxAgeSeconds: 0,
    },
  ],
})

new aws.s3.BucketLifecycleConfigurationV2("UploadAssetsLifecycle", {
  bucket: bucket.id,
  rules: [
    {
      id: "daily",
      expiration: {
        days: 1,
      },
      noncurrentVersionExpiration: {
        noncurrentDays: 1,
      },
      filter: {
        prefix: "_assets/temp/daily/",
      },
      status: "Enabled",
    },
  ],
})

sst.Linkable.wrap(aws.s3.BucketV2, (provider) => ({
  properties: { name: provider.id, arn: provider.arn },
  include: [
    sst.aws.permission({
      actions: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      resources: [provider.arn, $util.interpolate`${provider.arn}/*`],
    }),
  ],
}))
