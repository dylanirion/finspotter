import { useState } from "react"
import { getImageProps } from "next/image"
import { MediaLayer } from "@finspotter/canvas/media"
import { type Individual } from "@finspotter/core/individual"
import { Img } from "components/ui/images/Img"
import { cn } from "lib/utils"

import { IndividualCanvas } from "./IndividualCanvas"
import { MediaCarousel } from "./MediaCarousel"

export function IndividualPanel({
  encounters,
}: {
  encounters: Individual["encounters"]
}) {
  const [items, _setItems] = useState(
    encounters.map((annotation) => annotation)
  )
  const [focalItemIndex, setFocalItemIndex] = useState(0)
  const { media, ...annotation } = items[focalItemIndex]

  const {
    props: { id, ...imgProps },
  } = getImageProps({
    src: media.src,
    width: Number(media.exif?.width ?? 4000),
    height: Number(media.exif?.height ?? 3000),
    alt: "",
    sizes: "(min-width: 1024px) 60vw, (max-width: 1024px) 100vw",
  })

  const optimizedMedia = {
    ...media,
    ...imgProps,
  }

  //TODO: changing item rerenders entire carousel if an annotation is present? move to own component?
  //TODO: preload carousel images?
  //TODO: limit height of Canvas?
  return (
    <div
      className="flex flex-col gap-2" // h-[calc(100dvh_-_8rem)]
    >
      <IndividualCanvas media={optimizedMedia}>
        <MediaLayer media={optimizedMedia}></MediaLayer>
      </IndividualCanvas>
      {items.length > 1 && (
        <div className="my-auto flex justify-center px-8">
          <MediaCarousel className="w-full max-w-3xl">
            {items.map((item, i) => (
              <Img
                //TODO: object-contain? would be nice to shrink CarouselItem to contents, Img has hard-coded 4/3 aspect
                className={cn("rounded-md object-cover hover:cursor-pointer", {
                  "outline-2 outline-offset-2 outline-indigo-600":
                    i === focalItemIndex,
                })}
                key={item.media.id}
                src={item.media.src}
                onClick={() => setFocalItemIndex(i)}
                alt="Encounter Image"
                fill
                sizes="(max-width: 1024px) 20vw, (min-width: 1024px) 10vw" //TODO: get these from Carousel Width?
              />
            ))}
          </MediaCarousel>
        </div>
      )}
    </div>
  )
}
