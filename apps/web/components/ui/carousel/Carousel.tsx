"use client"

import {
  ComponentPropsWithRef,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type HTMLProps,
  type KeyboardEvent,
  type PropsWithChildren,
  type SetStateAction,
} from "react"
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline"
import { Button } from "components/ui/inputs/Button"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { cn } from "lib/utils"

export type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

const CarouselContext = createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

export function Carousel({
  ref,
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: HTMLProps<HTMLDivElement> & CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins
  )
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const onSelect = useCallback((api: CarouselApi) => {
    if (!api) {
      return
    }

    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
  }, [])

  const scrollPrev = useCallback(() => {
    api?.scrollPrev()
  }, [api])

  const scrollNext = useCallback(() => {
    api?.scrollNext()
  }, [api])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext]
  )

  useEffect(() => {
    if (!api || !setApi) {
      return
    }

    setApi(api)
  }, [api, setApi])

  useEffect(() => {
    if (!api) {
      return
    }

    onSelect(api)
    api.on("reInit", onSelect)
    api.on("select", onSelect)

    return () => {
      api?.off("select", onSelect)
    }
  }, [api, onSelect])

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation:
          orientation ?? (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        ref={ref}
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

export function CarouselContent({
  ref,
  className,
  ...props
}: HTMLProps<HTMLDivElement>) {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
}

export function CarouselItem({
  ref,
  className,
  ...props
}: HTMLProps<HTMLDivElement>) {
  const { orientation } = useCarousel()

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
}

export function CarouselPrevious({
  ref,
  className,
  intent = "none",
  size = "none",
  ...props
}: ComponentPropsWithRef<typeof Button>) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      ref={ref}
      intent={intent}
      size={size}
      className={cn(
        "absolute size-4 rounded-full",
        orientation === "horizontal"
          ? "top-1/2 -left-8 -translate-y-1/2"
          : "-top-8 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeftIcon />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
}

export function CarouselNext({
  ref,
  className,
  intent = "none",
  size = "none",
  ...props
}: ComponentPropsWithRef<typeof Button>) {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      ref={ref}
      intent={intent}
      size={size}
      className={cn(
        "absolute size-4 rounded-full",
        orientation === "horizontal"
          ? "top-1/2 -right-8 -translate-y-1/2"
          : "-bottom-8 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRightIcon />
      <span className="sr-only">Next slide</span>
    </Button>
  )
}

export function useCarouselApi() {
  const context = useContext(CarouselApiContext)

  if (context === undefined) {
    throw new Error(
      "useCarouselApi must be used inside the CarouselApiProvider"
    )
  }

  return context
}

export const CarouselApiContext = createContext<
  | {
      api: CarouselApi | undefined
      setApi: Dispatch<SetStateAction<CarouselApi | undefined>>
    }
  | undefined
>(undefined)

export function CarouselApiProvider({ children }: PropsWithChildren<object>) {
  const [api, setApi] = useState<CarouselApi>()

  return (
    <CarouselApiContext.Provider
      value={{
        api,
        setApi,
      }}
    >
      {children}
    </CarouselApiContext.Provider>
  )
}
