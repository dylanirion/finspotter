//import { useCallback, useEffect, useState } from "react"

//import { AnnotationLayer } from "components/ui/canvas/AnnotationLayer"
import { type PropsWithChildren } from "react"
import { Canvas } from "@finspotter/canvas"

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
      className="h-[calc(100dvh_-_15rem)] justify-center rounded-md shadow-md"
      width={media.exif?.width}
      height={media.exif?.height}
    >
      {children}
    </Canvas>
  )
}
