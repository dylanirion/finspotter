"use client"

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
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
import { cn, dimensionsToAspectString } from "./utils"

export { eventBus } from "./machines/EventBus"

const aspectVariants = {
  "4/3": "aspect-[4/3]",
  "3/4": "aspect-[3/4]",
  "7/8": "aspect-[7/8]",
  "8/7": "aspect-[8/7]",
  "16/9": "aspect-[16/9]",
  "9/16": "aspect-[9/16]",
}

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
  const aspect =
    dimensionsToAspectString(dimensions.width, dimensions.height) ?? "4/3"
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
              <GridSpinner className="absolute left-1/2 top-1/2 z-10 size-1/3 -translate-x-1/2 -translate-y-1/2 text-gray-100" />
            )}
            <div
              ref={containerRef}
              className={cn(
                size,
                aspectVariants[aspect as keyof typeof aspectVariants],
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
                  <PhotoIcon className="absolute left-1/2 top-1/2 z-10 size-2/3 -translate-x-1/2 -translate-y-1/2 text-gray-100" />
                  <div
                    style={{
                      width: dimensions.width,
                      height: dimensions.height,
                    }}
                  ></div>
                </div>
              )}
              {status === "error" && (
                <div className="size-full items-center justify-center overflow-hidden">
                  <ExclamationTriangleIcon className="absolute left-1/2 top-1/2 z-10 size-2/3 -translate-x-1/2 -translate-y-1/2 text-gray-100" />
                  <div
                    style={{
                      width: dimensions.width,
                      height: dimensions.height,
                    }}
                  ></div>
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
