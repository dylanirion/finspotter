import { NextRequest, NextResponse } from "next/server"
import { createStorageRepository } from "@finspotter/core/storage"
import { Resource } from "sst"

const { getObject } = createStorageRepository()

//TODO: check permissions of user requesting media
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params
    const objectKey = key.join("/")

    const response = await getObject(Resource.Uploads.name, objectKey)

    const headers = new Headers()
    headers.set(
      "Content-Type",
      response.metadata.contentType || "application/octet-stream"
    )
    headers.set(
      "Cache-Control",
      response.metadata.cacheControl || "private, max-age=31536000, immutable"
    )
    headers.set("Access-Control-Allow-Origin", "*")

    if (!response.body) {
      return NextResponse.json(
        { error: "Image body is empty" },
        { status: 404 }
      )
    }

    return new NextResponse(response.body as ReadableStream, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("S3 Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch image from S3" },
      { status: 500 }
    )
  }
}
