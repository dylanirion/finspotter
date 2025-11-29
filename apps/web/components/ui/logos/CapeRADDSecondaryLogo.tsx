import Image from "next/image"
import { site } from "@finspotter/config/site"

export function CapeRADDSecondaryLogo({ className }: { className: string }) {
  return (
    <Image
      className={className}
      src={site.secondaryLogo.src}
      alt={`${site.title} - Secondary Logo`}
      width={286}
      height={100}
    />
  )
}
