import Image from "next/image"
import { site } from "@finspotter/config/site"

export function CapeRADDPrimaryLogo({ className }: { className: string }) {
  return (
    <Image
      className={className}
      src={site.primaryLogo.src}
      alt={`${site.title} - Primary Logo`}
      width={218}
      height={221}
    />
  )
}
