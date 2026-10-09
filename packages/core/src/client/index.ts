import { S3Client } from "@aws-sdk/client-s3"

type ClientConstructor<Client, Config extends object> = new (
  config: Config
) => Client

const clients = new WeakMap<object, object>()

export function getClient<Client extends object, Config extends object>(
  c: ClientConstructor<Client, Config>,
  opts?: Config
): Client {
  if (isLocalDevelopment()) {
    if (c === S3Client) {
      return new c({
        ...opts,
        endpoint: "http://localhost:9000",
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.RUSTFS_ACCESS_KEY,
          secretAccessKey: process.env.RUSTFS_SECRET_KEY,
        },
      } as Config)
    }
    return new c((opts ?? {}) as Config)
  }

  const existing = clients.get(c)
  if (existing) return existing as Client

  const client = new c((opts ?? {}) as Config)
  clients.set(c, client)
  return client
}

export function isLocalDevelopment() {
  return (
    process.env.SST_DEV === "true" || process.env.NODE_ENV === "development"
  )
}
