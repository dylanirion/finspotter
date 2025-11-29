/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any | null = null

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
export function getClient<C extends any>(
  c: new (config: any) => C,
  opts?: any
): C {
  const isDev = process.env.NODE_ENV !== "production"

  if (isDev) {
    return new c({ ...opts })
  }

  if (!client) {
    client = new c({ ...opts })
  }

  return client
}
