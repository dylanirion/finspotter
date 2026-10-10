"use client"

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type RefCallback,
  type RefObject,
  type SetStateAction,
} from "react"
import { ExclamationTriangleIcon, PhotoIcon } from "@heroicons/react/24/solid"

import { GridSpinner } from "./spinners/GridSpinner"
import { cn } from "./utils"

export { eventBus } from "./machines/EventBus"

interface CanvasProps {
  id: string | number
  className?: string
  width?: string | number
  height?: string | number
  isProcessing?: boolean
}

interface Dimensions {
  width: number
  height: number
}

export interface Transform extends Partial<Dimensions> {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export const Canvas = forwardRef<
  HTMLCanvasElement,
  PropsWithChildren<CanvasProps>
>(function Canvas(
  { id, className, width = 4000, height = 3000, isProcessing, children },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [render, setRender] = useState(1)
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: Number(width),
    height: Number(height),
  })
  const animationFrame = useRef<number | undefined>(undefined)
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  )
  // Keep the reserved box in step with the requested dimensions, so a changed
  // viewport (e.g. a rotated crop) does not render at a stale aspect ratio
  // until the media layer reports its scaled dimensions.
  useEffect(() => {
    setDimensions((current) =>
      current.width === Number(width) && current.height === Number(height)
        ? current
        : { width: Number(width), height: Number(height) }
    )
  }, [width, height])
  const aspectRatio =
    dimensions.width > 0 && dimensions.height > 0
      ? `${dimensions.width} / ${dimensions.height}`
      : undefined
  const roundedRegex = /\b([\w:]*rounded(?:-[trblse]+)?(?:-(?:\[\w+\]|\w+))?)/
  const shadowRegex = /\b([\w*:]*shadow[-\w*]*)/
  const sizeRegex = /\b((?:(?:min|max)-)?[wh]-(?:\[\S+\]|\w+(?:-\w+)*))/
  const rounded = className?.match(new RegExp(roundedRegex, "g")) ?? []
  const shadow = className?.match(new RegExp(shadowRegex, "g")) ?? []
  const size = className?.match(new RegExp(sizeRegex, "g")) ?? []
  const filteredClassName = className
    ?.split(" ")
    .filter((str) => (str.match(roundedRegex) ?? []).length === 0)
    .filter((str) => (str.match(shadowRegex) ?? []).length === 0)
    .filter((str) => (str.match(sizeRegex) ?? []).length === 0)
    .join(" ")

  const withAnimationFrame = useCallback(
    (fn: () => void) => {
      if (!canvasRef.current) return
      animationFrame.current && cancelAnimationFrame(animationFrame.current)
      animationFrame.current = requestAnimationFrame(() => {
        fn()
      })
    },
    [canvasRef]
  )

  const handleResize = useCallback(() => {
    withAnimationFrame(() => {
      setRender((x) => x + 1)
    })
  }, [withAnimationFrame])

  const disableContextMenu = (e: MouseEvent) => {
    e.preventDefault()
  }

  const canvasRefCallback: RefCallback<HTMLCanvasElement> = useCallback(
    (node) => {
      const controller = new AbortController()
      if (node == null) {
        if (canvasRef.current != null) {
          controller.abort()
          setCtx(null)
        }
        return
      }

      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }

      canvasRef.current = node
      canvasRef.current.addEventListener("contextmenu", disableContextMenu, {
        signal: controller.signal,
      })
      window.addEventListener("resize", handleResize, {
        signal: controller.signal,
      })

      if (!node.getContext("2d")) return
      setCtx(node.getContext("2d"))
    },
    [handleResize]
  )

  const canvasContext = useMemo(
    () => ({
      containerRef,
      canvasRef,
      canvasRefCallback,
      withAnimationFrame,
      setRender,
      setDimensions,
      setStatus,
    }),
    [ctx]
  )

  const renderingContext = {
    render,
  }

  return (
    <CanvasContext.Provider value={canvasContext}>
      <CanvasRenderingContext.Provider value={renderingContext}>
        <div className={filteredClassName}>
          <div className="relative flex justify-center">
            {isProcessing && (
              <GridSpinner className="absolute top-1/2 left-1/2 z-10 size-1/3 -translate-x-1/2 -translate-y-1/2 text-gray-100" />
            )}
            <div
              ref={containerRef}
              style={{ aspectRatio }}
              className={cn(
                size,
                "overflow-hidden object-contain",
                ...rounded,
                ...shadow,
                {
                  "animate-pulse bg-gray-200 dark:bg-slate-700":
                    status === "loading",
                  "bg-gray-200 dark:bg-slate-700": status === "error",
                }
              )}
            >
              {status === "loading" && (
                <div className="size-full items-center justify-center overflow-hidden">
                  <PhotoIcon className="absolute top-1/2 left-1/2 z-10 size-2/3 -translate-x-1/2 -translate-y-1/2 text-gray-100" />
                </div>
              )}
              {status === "error" && (
                <div className="size-full items-center justify-center overflow-hidden">
                  <ExclamationTriangleIcon className="absolute top-1/2 left-1/2 z-10 size-2/3 -translate-x-1/2 -translate-y-1/2 text-gray-100" />
                </div>
              )}
              {status === "loaded" && (
                <canvas
                  key={id}
                  className="size-full"
                  ref={canvasRefCallback}
                  tabIndex={-1}
                  width={dimensions.width}
                  height={dimensions.height}
                ></canvas>
              )}
            </div>
            {children}
          </div>
        </div>
      </CanvasRenderingContext.Provider>
    </CanvasContext.Provider>
  )
})
Canvas.displayName = "Canvas"

const CanvasContext = createContext<
  | {
      containerRef: RefObject<HTMLDivElement | null>
      canvasRef: RefObject<HTMLCanvasElement | null>
      canvasRefCallback: RefCallback<HTMLCanvasElement>
      withAnimationFrame: (fn: () => void) => void
      setRender: Dispatch<SetStateAction<number>>
      setDimensions: Dispatch<SetStateAction<Dimensions>>
      setStatus: Dispatch<SetStateAction<"loading" | "loaded" | "error">>
    }
  | undefined
>(undefined)

const CanvasRenderingContext = createContext<
  | {
      render: number
    }
  | undefined
>(undefined)

export function useCanvas() {
  const context = useContext(CanvasContext)

  if (context === undefined) {
    throw new Error("useCanvas must be used inside a Canvas")
  }

  return context
}

export function useCanvasRenderingContext() {
  const context = useContext(CanvasRenderingContext)

  if (context === undefined) {
    throw new Error("useCanvasRenderingContext must be used inside a Canvas")
  }

  return context
}
