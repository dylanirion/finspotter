import { S3Client } from "@aws-sdk/client-s3"

/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any | null = null

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
export function getClient<C extends any>(
  c: new (config: any) => C,
  opts?: any
): C {
  const isDev = process.env.NODE_ENV !== "production"

  if (isDev) {
    if (c === S3Client) {
      return new c({
        ...opts,
        endpoint: "http://localhost:9000",
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.RUSTFS_ACCESS_KEY,
          secretAccessKey: process.env.RUSTFS_SECRET_KEY,
        },
      })
    }

    return new c({ ...opts })
  }

  if (!client) {
    client = new c({ ...opts })
  }

  return client
}
