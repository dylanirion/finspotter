"use client"

import { useState } from "react"
import Image, { ImageProps } from "next/image"
import { UserCircleIcon } from "@heroicons/react/24/outline"

export function ProfilePicture(
  props: Omit<ImageProps, "src"> & Partial<Pick<ImageProps, "src">>
) {
  const { src, alt, className, ...other } = props
  const [isError, setError] = useState(false)

  if (!src || isError) {
    return <UserCircleIcon className={className} />
  } else {
    return (
      <Image
        className={className}
        alt={alt}
        src={src}
        onError={() => setError(true)}
        {...other}
      />
    )
  }
}
