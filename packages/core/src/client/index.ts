import { S3Client } from "@aws-sdk/client-s3"

/* eslint-disable @typescript-eslint/no-explicit-any */
const clients = new WeakMap<object, any>()

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
export function getClient<C extends any>(
  c: new (config: any) => C,
  opts?: any
): C {
  const isDev = isLocalDevelopment()

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

  const existing = clients.get(c)
  if (existing) return existing

  const client = new c({ ...opts })
  clients.set(c, client)
  return client
}

export function isLocalDevelopment() {
  return (
    process.env.SST_DEV === "true" || process.env.NODE_ENV === "development"
  )
}
