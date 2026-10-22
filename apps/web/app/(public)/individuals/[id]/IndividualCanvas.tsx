//import { useCallback, useEffect, useState } from "react"

//import { AnnotationLayer } from "components/ui/canvas/AnnotationLayer"
import { type PropsWithChildren } from "react"
import { Canvas } from "@finspotter/canvas"
import { cn } from "lib/utils"

//import { AnnotationTransformerProvider } from "hooks/useAnnotationTransformer"
//import { useMediaCanvas } from "hooks/useMediaCanvas"
//import { twCols } from "utils"

interface CanvasProps {
  media: { id: string; exif?: { width?: string; height?: string } }
}

export function IndividualCanvas({
  media,
  children,
}: PropsWithChildren<CanvasProps>) {
  const isPortrait =
    Number(media.exif?.height ?? 0) > Number(media.exif?.width ?? 0)

  /*
  const {
    canvasRef: { current: canvas },
  } = useMediaCanvas()
  const [isHover, setHover] = useState(false)

  const toggleHover = useCallback((e: MouseEvent) => {
    setHover(e.type == "mouseover" ? true : false)
  }, [])

  useEffect(() => {
    if (!canvas) return
    canvas.addEventListener("mouseover", toggleHover)
    canvas.addEventListener("mouseout", toggleHover)

    return () => {
      setHover(false)
      canvas.removeEventListener("mouseover", toggleHover)
      canvas.removeEventListener("mouseout", toggleHover)
    }
  }, [canvas, toggleHover])
  */
  //TODO: hover mask effect doesn't work on IOS

  return (
    <Canvas
      key={media?.id}
      id={media?.id}
      className={cn("justify-center rounded-md shadow-md", {
        "h-[calc(100dvh-15rem)] w-auto": isPortrait,
        "w-full": !isPortrait,
      })}
      width={media.exif?.width}
      height={media.exif?.height}
    >
      {children}
    </Canvas>
  )
}
