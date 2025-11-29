import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Ref,
  type RefObject,
} from "react"
import { type Transform } from "@finspotter/canvas"

import { useCanvas, useCanvasRenderingContext } from "./"

const MAXIMUMPIXELS = 16777216

interface MediaLayerProps {
  ref?: Ref<{ matrix: DOMMatrix }>
  media: { src: string } & { srcSet?: string; sizes?: string }
  transform?: Transform
}

// TODO: video
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Manipulating_video_using_canvas
// https://github.com/mdn/dom-examples/tree/main/canvas/chroma-keying
// https://developer.mozilla.org/en-US/docs/Web/Media/Audio_and_video_delivery/Setting_up_adaptive_streaming_media_sources
// https://stackoverflow.com/a/39247028/3473055
export function MediaLayer({
  ref,
  media,
  transform,
  children,
}: PropsWithChildren<MediaLayerProps>) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [scale, setScale] = useState(1)
  const {
    containerRef,
    canvasRef: { current: canvas },
    setStatus,
    setDimensions,
  } = useCanvas()
  useCanvasRenderingContext()
  const ctx = canvas?.getContext("2d")

  const handleBrightness = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    console.debug("brightness", Number(e.target.value))
    setBrightness(Number(e.target.value))
  }, [])

  const handleContrast = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    console.debug("contrast", Number(e.target.value))
    setContrast(Number(e.target.value))
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      matrix: new DOMMatrix([
        scale * (transform?.a ?? 1),
        scale * (transform?.b ?? 0),
        scale * (transform?.c ?? 0),
        scale * (transform?.d ?? 1),
        scale * (transform?.e ?? 0),
        scale * (transform?.f ?? 0),
      ]),
    }),
    [scale]
  )

  // TODO: how to remove need for useEffect? (need it for browser's Image() class)
  // use node-canvas?
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setStatus("loaded")
      const {
        width: containerWidth = transform?.width ?? img.width,
        height: containerHeight = transform?.height ?? img.width,
      } = containerRef.current?.getBoundingClientRect() ?? {}
      const { width: limitedWidth, height: limitedHeight } = limitImageSize(
        transform?.width && transform?.height
          ? { width: transform?.width, height: transform.height }
          : img,
        Math.min(MAXIMUMPIXELS, containerWidth * containerHeight)
      )
      //TODO: scale gets used when drawing annotation, and calculating rect for annotations. can it be lumped in with transform?
      const scale = Math.min(
        limitedWidth / (transform?.width ?? img.width),
        limitedHeight / (transform?.height ?? img.height)
      )
      setScale(scale)
      setDimensions({
        width: (transform?.width ?? img.width) * scale,
        height: (transform?.height ?? img.height) * scale,
      })
    }
    img.onerror = () => {
      setStatus("error")
    }
    img.src = media.src
    img.srcset = media.srcSet ?? ""
    img.sizes = media.sizes ?? ""
    img.fetchPriority = "high"
    imageRef.current = img
  }, [])

  const context = useMemo(
    () => ({
      imageRef,
      brightness,
      contrast,
      transform,
      scale,
      handleBrightness,
      handleContrast,
    }),
    [brightness, contrast, transform, scale]
  )

  if (!ctx || !imageRef.current || !canvas) return <></>
  ctx.save()
  ctx.transform(
    scale * (transform?.a ?? 1),
    scale * (transform?.b ?? 0),
    scale * (transform?.c ?? 0),
    scale * (transform?.d ?? 1),
    scale * (transform?.e ?? 0),
    scale * (transform?.f ?? 0)
  )
  ctx.filter = `brightness(${brightness + 100}%) contrast(${contrast + 100}%)`
  console.debug(`drawing MediaLayer<${imageRef.current.src}>`)
  ctx.drawImage(imageRef.current as CanvasImageSource, 0, 0)
  ctx.restore()

  return (
    <ImageContext.Provider value={context}>{children}</ImageContext.Provider>
  )
}

// https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/
export function limitImageSize(
  image: HTMLImageElement | { width: number; height: number },
  maximumPixels = MAXIMUMPIXELS ?? 16777216
) {
  const { width, height } = image

  const requiredPixels = width * height
  if (requiredPixels <= maximumPixels) return { width, height }

  const scale = Math.sqrt(maximumPixels) / Math.sqrt(requiredPixels)

  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
  }
}

export function useImage() {
  const context = useContext(ImageContext)

  if (context === undefined) {
    throw new Error("useImage must be used inside a MediaLayer")
  }

  return context
}

export const ImageContext = createContext<
  | {
      imageRef: RefObject<HTMLImageElement | null>
      brightness: number
      contrast: number
      scale: number
      transform?: Transform
      handleBrightness: (e: ChangeEvent<HTMLInputElement>) => void
      handleContrast: (e: ChangeEvent<HTMLInputElement>) => void
    }
  | undefined
>(undefined)
