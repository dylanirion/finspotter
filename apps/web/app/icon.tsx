import { ImageResponse } from "next/og"
import { SiteLogo } from "components/ui/logos/SiteLogo"

export const size = {
  width: 32,
  height: 32,
}
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div tw="flex w-full h-full items-center justify-center">
        <SiteLogo style={{ height: "32px", width: "32px" }} />
      </div>
    ),
    {
      ...size,
    }
  )
}
