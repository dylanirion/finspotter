import { useCallback, useState, type HTMLProps } from "react"
import Image, { ImageProps } from "next/image"
import { ExclamationTriangleIcon, PhotoIcon } from "@heroicons/react/24/solid"
import { cn, rgbDataURL } from "lib/utils"

export function Img(props: ImageProps & HTMLProps<HTMLImageElement>) {
  const { ref, src, alt, className, ...other } = props
  const [isLoading, setLoading] = useState(true)
  const [isError, setError] = useState(false)

  const handleLoad = useCallback(() => {
    setLoading(false)
  }, [])

  const handleError = useCallback(() => {
    setError(true)
  }, [])

  if (!src || isError) {
    return (
      <div className="relative aspect-[4/3] rounded bg-gray-200 dark:bg-slate-500">
        <div className="absolute z-10 flex size-full items-center justify-center">
          <ExclamationTriangleIcon className="size-16 text-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] rounded">
      <div
        className={cn(
          "absolute z-10 flex h-full w-full animate-pulse items-center justify-center rounded bg-gray-200 dark:bg-slate-500",
          {
            hidden: !isLoading,
          }
        )}
      >
        <PhotoIcon className="size-16 text-white" />
      </div>
      <Image
        ref={ref}
        className={className}
        alt={alt}
        src={src}
        placeholder="blur"
        blurDataURL={rgbDataURL(156, 163, 175)} //TODO: can I make this the svg? how to size?
        onLoad={handleLoad}
        onError={handleError}
        {...other}
      />
    </div>
  )
}
