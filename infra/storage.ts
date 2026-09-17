import { domain } from "./domain"

//TODO: SSL only

export const bucket = $dev
  ? new sst.Linkable("Uploads", {
      properties: { name: "uploads-dev" },
    })
  : new sst.aws.Bucket("Uploads", {
      cors: {
        allowHeaders: ["*"],
        allowMethods: ["POST", "PUT", "GET", "HEAD", "DELETE"],
        allowOrigins: [$dev ? `http://${domain}` : `https://${domain}`],
        exposeHeaders: [],
        maxAge: "0 seconds",
      },
      lifecycle: [
        {
          prefix: "temp/daily/",
          expiresIn: "1 day",
        },
      ],
    })
