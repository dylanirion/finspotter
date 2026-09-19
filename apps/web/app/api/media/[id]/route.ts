import { createHmac, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createMediaRepository } from "@finspotter/core/media"
import { createStorageRepository } from "@finspotter/core/storage"
import { Resource } from "sst"
import { z } from "zod"

const PUBLIC_CACHE_CONTROL = "public, max-age=31536000, immutable"
const PRIVATE_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate, stale-if-error=0"

const { findOne } = createMediaRepository()
const { getObject } = createStorageRepository()

type MediaAccess = {
  visibility: "public" | "restricted"
  version: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const parsedId = z.uuid().safeParse(id)
    if (!parsedId.success) return notFound()

    const media = await findOne({ id })
    if (!media) return notFound()

    const access = await resolveMediaAccess(id)
    if (!(await canViewMedia(request, id, access))) return notFound()

    const response = await getObject(Resource.Uploads.name, media.src)

    const headers = new Headers()
    headers.set(
      "Content-Type",
      response.metadata.contentType || "application/octet-stream"
    )
    headers.set(
      "Cache-Control",
      access.visibility === "public"
        ? PUBLIC_CACHE_CONTROL
        : PRIVATE_CACHE_CONTROL
    )

    if (!response.body) {
      return notFound()
    }

    return new NextResponse(response.body as ReadableStream, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Media resolver error:", error)
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    )
  }
}

async function resolveMediaAccess(mediaId: string): Promise<MediaAccess> {
  /*
   * TODO: Resolve access from normalized tables and the existing submission row.
   *
   * media_access
   *   media_id uuid primary key references media(id) on delete cascade
   *   visibility enum('public', 'private', 'organization') not null
   *
   * media_user_access
   *   media_id uuid references media(id) on delete cascade
   *   user_id uuid references user(id) on delete cascade
   *   primary key (media_id, user_id)
   *
   * media_organization_access
   *   media_id uuid references media(id) on delete cascade
   *   organization_id uuid references organization(id) on delete cascade
   *   primary key (media_id, organization_id)
   *
   * Public allows everyone. Private allows the submitter and explicit user or
   * organization grants. Organization additionally allows current members of
   * submissions.organization_id. Global role permissions may override denial.
   */
  return { visibility: "restricted", version: 0 }
}

async function canViewMedia(
  request: NextRequest,
  mediaId: string,
  access: MediaAccess
) {
  if (access.visibility === "public") return true

  const token = request.nextUrl.searchParams.get("token")
  return token ? verifyCapability(token, mediaId, access.version) : false
}

function verifyCapability(token: string, mediaId: string, version: number) {
  const [expiresAtValue, suppliedSignature, ...extra] = token.split(".")
  const expiresAt = Number(expiresAtValue)

  if (
    extra.length ||
    !expiresAtValue ||
    !suppliedSignature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return false
  }

  const expectedSignature = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(`${mediaId}\n${version}\n${expiresAt}\nmedia`)
    .digest()

  let supplied: Buffer
  try {
    supplied = Buffer.from(suppliedSignature, "base64url")
  } catch {
    return false
  }

  return (
    supplied.length === expectedSignature.length &&
    timingSafeEqual(supplied, expectedSignature)
  )
}

function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": PRIVATE_CACHE_CONTROL },
  })
}
