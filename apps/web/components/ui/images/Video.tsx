import {
  type DetailedHTMLProps,
  type SourceHTMLAttributes,
  type VideoHTMLAttributes,
} from "react"
import { getImageProps, type ImageProps } from "next/image"

type VideoProps = DetailedHTMLProps<
  VideoHTMLAttributes<HTMLVideoElement>,
  HTMLVideoElement
> &
  DetailedHTMLProps<
    SourceHTMLAttributes<HTMLSourceElement>,
    HTMLSourceElement
  > & { fill: boolean }

//TODO: custom controls
export function Video(props: VideoProps) {
  const { src, type, fill, ...rest } = props
  if (!src) return
  const {
    props: { style },
  } = getImageProps({
    ...["src", "sizes", "width", "height", "fill", "style"]
      .filter((key) => key in props)
      .reduce(
        (acc, cur) => (
          (acc[cur as keyof typeof acc] = props[cur as keyof typeof props]),
          acc
        ),
        {} as ImageProps
      ),
    alt: "",
  })
  return (
    <video {...rest} style={style}>
      <source src={src} type={type} />
      Your browser does not support the video tag.
    </video>
  )
}
