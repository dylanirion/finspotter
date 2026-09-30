type ObjectRecord = Record<string, unknown>

export function requireObject<T extends object>(
  value: unknown,
  requiredKeys: readonly (keyof T & string)[],
  name: string
): T {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    const valueType = Array.isArray(value) ? "array" : typeof value
    throw new TypeError(
      `Expected ${name} to be an object, got ${valueType}: ${JSON.stringify(value)}. ` +
        "An upstream Lambda may have returned an error response as data."
    )
  }

  const record = value as ObjectRecord
  const missingKeys = requiredKeys.filter((key) => !(key in record))
  if (missingKeys.length > 0) {
    throw new TypeError(
      `${name} is missing required fields: ${missingKeys.join(", ")}`
    )
  }

  return value as T
}

export function requireObjectPayload<T extends object>(
  event: unknown,
  requiredKeys: readonly (keyof T & string)[]
): T {
  const eventObject = requireObject<{ payload: unknown }>(
    event,
    ["payload"],
    "event"
  )
  return requireObject<T>(eventObject.payload, requiredKeys, "event.payload")
}
