"use client"

import {
  Children,
  memo,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarouselApi,
} from "components/ui/carousel/Carousel"
import { cn } from "lib/utils"

export const AboutCarousel = memo(function AboutCarousel({
  children,
}: PropsWithChildren<object>) {
  const [currentStep, setCurrentStep] = useState(0)
  const { api, setApi } = useCarouselApi()
  const showingDropZone = api && (currentStep === 0 || currentStep === 2)

  useEffect(() => {
    if (!api) return
    setCurrentStep(api.selectedScrollSnap())
    api.on("select", () => {
      setCurrentStep(api.selectedScrollSnap())
    })
  }, [api])

  return (
    <Carousel
      className={cn("w-full p-2 lg:w-1/2", {
        "h-96": showingDropZone,
        "h-80": !showingDropZone,
      })}
      setApi={setApi}
      orientation="horizontal" // TODO: vertical on > small screen? can't figure this out
      opts={{ watchDrag: false }}
    >
      <CarouselContent>
        {Children.map(children, (child, i) => (
          <CarouselItem>{currentStep === i && child}</CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
})
AboutCarousel.displayName = "AboutCarousel"
