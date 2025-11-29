import { Children, type PropsWithChildren } from "react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "components/ui/carousel/Carousel"

export function MediaCarousel({
  className,
  children,
}: PropsWithChildren<{
  className: string
}>) {
  return (
    <Carousel className={className}>
      <CarouselContent className="ml-1">
        {Children.map(children, (child) => (
          <CarouselItem className="basis-1/6 p-2">{child}</CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  )
}
