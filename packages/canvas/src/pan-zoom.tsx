import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  type ComponentPropsWithoutRef,
  type Ref,
} from "react"
import { clientToCanvas } from "@finspotter/canvas/utils"
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline"
import { useActorRef, useSelector } from "@xstate/react"
import { ActorRefFrom, ContextFrom, StateFrom, type ActionArgs } from "xstate"

import { useCanvas, useCanvasRenderingContext } from "./"
import { ArrowsPointingOutIcon } from "./icons/ArrowsPointingOutIcon"
import {
  MAX_ZOOM,
  panZoomMachine,
  type EventTypes,
} from "./machines/panZoomMachine"
import { cn } from "./utils"

const panStateSelector = (state: StateFrom<typeof panZoomMachine>) =>
  state.matches("pan")
const lockStateSelector = (state: StateFrom<typeof panZoomMachine>) =>
  state.matches("locked")

export type PanZoomService = ActorRefFrom<typeof panZoomMachine>

export function PanZoomPanel({
  ref,
  className,
}: {
  ref?: Ref<{ service: ActorRefFrom<typeof panZoomMachine> }>
  className?: string
}) {
  const {
    canvasRef: { current: canvas },
    withAnimationFrame,
    setRender,
  } = useCanvas()
  const ctx = canvas?.getContext("2d")

  const handleZoom = useCallback(
    (
      context: ActionArgs<
        ContextFrom<typeof panZoomMachine>,
        EventTypes,
        EventTypes
      >
    ) => {
      if (!ctx || !canvas) return
      const {
        context: {
          mouse: { x, y },
          zoom,
        },
        event,
      } = context
      const transform = ctx.getTransform()
      const scaledX =
        event.type === "wheel"
          ? x - (x - transform.e) * (zoom / transform.a)
          : canvas.width / 2 -
            (canvas.width / 2 - transform.e) * (zoom / transform.a)
      const scaledY =
        event.type === "wheel"
          ? y - (y - transform.f) * (zoom / transform.a)
          : canvas.height / 2 -
            (canvas.height / 2 - transform.f) * (zoom / transform.a)
      ctx.setTransform(
        ...[
          clamp(
            {
              ...transform,
              a: zoom,
              d: zoom,
              e: scaledX,
              f: scaledY,
            },
            canvas
          ),
        ]
      )
      ctx.getTransform().a === 1 && panZoomService.send({ type: "idle" })
    },
    [ctx, canvas]
  )

  const handlePan = useCallback(
    (
      context: ActionArgs<
        ContextFrom<typeof panZoomMachine>,
        EventTypes,
        EventTypes
      >
    ) => {
      if (!ctx || !canvas) return
      const { mouse, lastMouse } = context.context
      const transform = ctx.getTransform()
      ctx.setTransform(
        clamp(
          {
            a: transform.a,
            b: 0,
            c: 0,
            d: transform.a,
            e: transform.e + mouse.x - lastMouse.x,
            f: transform.f + mouse.y - lastMouse.y,
          },
          canvas
        )
      )
    },
    [ctx, canvas]
  )

  const handleMouse = useCallback(
    (e: MouseEvent | WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!ctx || !canvas) return
      const { x, y } = clientToCanvas(e.clientX, e.clientY, canvas)
      panZoomService.send({
        type: e.type as "mousemove" | "mousedown" | "mouseup" | "mouseleave",
        mouse: { x, y },
        button: e.button,
        ...("deltaY" in e && { deltaY: e.deltaY }),
      })
    },
    [ctx]
  )

  const handleAttachPanListener = useCallback(() => {
    if (!ctx || !canvas) return
    console.debug("Attaching pan mousemove handler")
    canvas.addEventListener("mousemove", handleMouse)
  }, [handleMouse])

  const handleRemovePanListener = useCallback(() => {
    if (!ctx || !canvas) return
    console.debug("Removing pan mousemove handler")
    canvas.removeEventListener("mousemove", handleMouse)
  }, [handleMouse])

  const handleAttachClickListeners = useCallback(() => {
    if (!ctx || !canvas) return
    console.debug("Attaching pan mouseclick handlers")
    canvas.addEventListener("mousedown", handleMouse)
    canvas.addEventListener("mouseup", handleMouse)
    canvas.addEventListener("mouseleave", handleMouse)
  }, [handleMouse])

  const handleRemoveClickListeners = useCallback(() => {
    if (!ctx || !canvas) return
    console.debug("Removing pan mouseclick handlers")
    canvas.removeEventListener("mousedown", handleMouse)
    canvas.removeEventListener("mouseup", handleMouse)
    canvas.removeEventListener("mouseleave", handleMouse)
  }, [handleMouse])

  const panZoomService = useActorRef(
    panZoomMachine.provide({
      actions: {
        handlePan,
        handleZoom,
        handleAttachClickListeners,
        handleRemoveClickListeners,
        handleAttachPanListener,
        handleRemovePanListener,
        render: () => {
          withAnimationFrame(() => {
            setRender((x) => x + 1)
          })
        },
      },
    })
  )

  useImperativeHandle(
    ref,
    () => ({
      service: panZoomService,
    }),
    []
  )

  const handleOnZoomIn = useCallback(
    () => panZoomService.send({ type: "zoom.in" }),
    []
  )

  const handleOnZoomOut = useCallback(
    () => panZoomService.send({ type: "zoom.out" }),
    []
  )

  const isPan = useSelector(panZoomService, panStateSelector)

  //cursors & wheel listener
  useEffect(() => {
    if (!canvas) return
    const controller = new AbortController()
    canvas.addEventListener("wheel", handleMouse, {
      passive: false,
      signal: controller.signal,
    })
    const subscription = panZoomService.subscribe((state) => {
      const currentCursor = canvas.className.match(/cursor-[^\s]*/)?.[0]
      switch (true) {
        case state.matches({ pan: "idle" }):
          currentCursor && canvas.classList.remove(currentCursor)
          canvas.classList.add("cursor-grab")
          break
        case state.matches({ pan: "panning" }):
          currentCursor && canvas.classList.remove(currentCursor)
          canvas.classList.add("cursor-grabbing")
          break
        case state.matches("idle"):
          currentCursor && canvas.classList.remove(currentCursor)
          canvas.classList.add("cursor-defaut")
          break
      }
      console.debug("PanZoomService state:", {
        state: state.value,
        ...state.context,
      })
    })

    return () => {
      if (canvas) {
        const currentCursor = canvas.className.match(/cursor-[^\s]*/)?.[0]
        currentCursor && canvas.classList.remove(currentCursor)
        controller.abort()
        handleRemoveClickListeners()
        handleRemovePanListener()
      }
      subscription.unsubscribe()
    }
  }, [canvas, panZoomService])

  if (!canvas || !ctx) return

  return (
    <div className={cn("pointer-events-auto flex flex-col gap-1", className)}>
      <ZoomInButton
        className="size-8 cursor-pointer rounded-md bg-slate-900 opacity-60 hover:opacity-75"
        title="Zoom In"
        onClick={handleOnZoomIn}
      >
        <MagnifyingGlassPlusIcon className="block text-gray-300" />
      </ZoomInButton>
      <ZoomOutButton
        className="size-8 cursor-pointer rounded-md bg-slate-900 opacity-60 hover:opacity-75"
        title="Zoom Out"
        onClick={handleOnZoomOut}
      >
        <MagnifyingGlassMinusIcon className="block text-gray-300" />
      </ZoomOutButton>
      <PanButton
        className={cn(
          "h-8 w-8 cursor-pointer rounded-md bg-slate-900 p-1 opacity-60 hover:opacity-75 disabled:cursor-not-allowed",
          {
            "bg-gray-300": isPan,
          }
        )}
        title="Pan"
        onClick={() => panZoomService.send({ type: "pan.toggle" })}
        service={panZoomService}
      >
        <ArrowsPointingOutIcon
          className={cn("block text-gray-300", {
            "text-slate-900": isPan,
          })}
        />
      </PanButton>
    </div>
  )
}

const ZoomInButton = memo(function ZoomInButton(
  props: ComponentPropsWithoutRef<"button">
) {
  const { children, ...rest } = props
  return <button {...rest}>{children}</button>
})

const ZoomOutButton = memo(function ZoomOutButton(
  props: ComponentPropsWithoutRef<"button">
) {
  const { children, ...rest } = props
  return <button {...rest}>{children}</button>
})

function PanButton(
  props: ComponentPropsWithoutRef<"button"> & {
    service: ActorRefFrom<typeof panZoomMachine>
  }
) {
  const { children, service, ...rest } = props
  const isLocked = useSelector(service, lockStateSelector)
  const {
    canvasRef: { current: canvas },
  } = useCanvas()
  const ctx = canvas?.getContext("2d")
  useCanvasRenderingContext()

  return (
    <button {...rest} disabled={ctx?.getTransform().a === 1 || isLocked}>
      {children}
    </button>
  )
}

function clamp(
  {
    a,
    b,
    c,
    d,
    e,
    f,
  }: {
    a: number
    b: number
    c: number
    d: number
    e: number
    f: number
  },
  canvas: HTMLCanvasElement
) {
  return {
    a: Math.min(Math.max(a, 1), MAX_ZOOM),
    b,
    c,
    d: Math.min(Math.max(d, 1), MAX_ZOOM),
    e: Math.min(Math.max(e, canvas.width * -(a - 1)), 0),
    f: Math.min(Math.max(f, canvas.height * -(a - 1)), 0),
  }
}
