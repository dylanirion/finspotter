import { domain } from "./domain"

//TODO: SSL only
export const bucket = new sst.aws.Bucket("UploadAssets", {
  cors: {
      allowHeaders: ["*"],
      allowMethods: ["POST", "PUT", "GET", "HEAD", "DELETE"],
      allowOrigins: [$dev ? `http://${domain}` : `https://${domain}`],
      exposeHeaders: [],
      maxAge: "0 seconds",
    },
  lifecycle: [
    {
      prefix: "_assets/temp/daily/",
      expiresIn: "1 day"
    }
  ]
})