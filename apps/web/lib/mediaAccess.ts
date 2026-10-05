import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export function createMediaCapability(
  mediaId: string,
  expiresAt: Date,
  version = 0
) {
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1_000)
  const signature = createHmac("sha256", requireSecret())
    .update(`${mediaId}\n${version}\n${expiresAtSeconds}\nmedia`)
    .digest("base64url")
  return `${expiresAtSeconds}.${signature}`
}

export function verifyMediaCapability(
  token: string,
  mediaId: string,
  version: number
) {
  const [expiresAtValue, suppliedSignature, ...extra] = token.split(".")
  const expiresAt = Number(expiresAtValue)
  if (
    extra.length ||
    !expiresAtValue ||
    !suppliedSignature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1_000)
  )
    return false

  const expected = createHmac("sha256", requireSecret())
    .update(`${mediaId}\n${version}\n${expiresAt}\nmedia`)
    .digest()

  let supplied: Buffer
  try {
    supplied = Buffer.from(suppliedSignature, "base64url")
  } catch {
    return false
  }
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}

function requireSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required")
  return secret
}