import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { can } from "@finspotter/core/auth/permissions"

const MEDIA_URL_WINDOW_MS = 60 * 60 * 1_000

type MediaViewer = Parameters<typeof can>[0] | null | undefined

/*
 * next/image fetches originals server-side without the viewer's cookies, so
 * protected media needs a capability in the URL. Expiry is aligned to an
 * hourly window (valid for 1-2h) so URLs, and the optimizer cache, are stable
 * across requests.
 */
export function mediaUrlExpiry(now = Date.now()) {
  return new Date(
    (Math.floor(now / MEDIA_URL_WINDOW_MS) + 2) * MEDIA_URL_WINDOW_MS
  )
}

export function signedMediaUrl(
  mediaId: string,
  expiresAt: Date = mediaUrlExpiry()
) {
  const token = createMediaCapability(mediaId, expiresAt)
  return `/api/media/${mediaId}?token=${encodeURIComponent(token)}`
}

/** Only signs for viewers the media route would already authorise by session. */
export function mediaUrlForViewer(viewer: MediaViewer, mediaId: string) {
  return viewer && can(viewer, "read", "Media")
    ? signedMediaUrl(mediaId)
    : `/api/media/${mediaId}`
}

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
