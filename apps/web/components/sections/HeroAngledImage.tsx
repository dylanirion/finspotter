import { type PropsWithChildren } from "react"
import Image from "next/image"

export function HeroAngledImage({
  className,
  src,
  alt,
  children,
}: PropsWithChildren<{ className: string; src: string; alt: string }>) {
  return (
    <div className={className}>
      <div className="relative mx-4 overflow-hidden">
        <div className="mx-auto max-w-7xl">
          <div className="relative z-10 bg-white pb-2 sm:pb-16 md:pb-20 lg:w-full lg:max-w-2xl lg:pb-28 xl:pb-32 dark:bg-slate-800">
            <svg
              className="absolute inset-y-0 right-0 hidden h-full w-48 translate-x-1/2 text-white lg:block dark:text-slate-800"
              fill="currentColor"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="50,0 100,0 50,100 0,100" />
            </svg>
            <main className="relative mx-auto max-w-7xl pt-2 sm:pt-16 md:pt-20 lg:pt-24 xl:pt-32">
              {children}
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <Image
            className="size-full rounded-r-lg object-cover sm:h-72 md:h-96 lg:size-full"
            src={src}
            alt={alt}
            fill
            sizes="50vw"
            priority
          />
        </div>
      </div>
    </div>
  )
}
