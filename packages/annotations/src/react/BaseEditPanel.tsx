import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react"
import { useCanvas } from "@finspotter/canvas"
import { useImage } from "@finspotter/canvas/media"
import { clientToImage } from "@finspotter/canvas/utils"
import { FloatingFocusManager } from "@floating-ui/react"
import { useSelector } from "@xstate/react"
import { type EventFromLogic, type SnapshotFrom, type StateFrom } from "xstate"

import { AnnotationDisplayTypes, AnnotationType, MachineType } from ".."
import { useAnnotation, type AnnotationStrategy } from "./BaseAnnotationLayer"
import { PopoverContext, usePopover, usePopoverContext } from "./Popover"

export type BaseEditPanelProps<T extends AnnotationType | "null"> = {
  setActive: Dispatch<SetStateAction<string[]>>
  strategy: AnnotationStrategy<T>
}

export function BaseEditPopover({ children }: PropsWithChildren<object>) {
  useAnnotation()
  const [open, setOpen] = useState(false)
  const popover = usePopover({ placement: "top-end", open, setOpen })

  return (
    <PopoverContext.Provider value={popover}>
      {children}
    </PopoverContext.Provider>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isEqual(a: any, b: any): boolean {
  // Handle simple cases
  if (a === b) return true
  if (a == null || b == null) return a === b

  // Handle different types
  if (typeof a !== typeof b) return false

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false
    }
    return true
  }

  // Handle objects
  if (typeof a === "object") {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!keysB.includes(key)) return false
      if (!isEqual(a[key], b[key])) return false
    }

    return true
  }

  // Handle other primitives
  return a === b
}

function selectShapeAndId<T extends AnnotationType | "null">(
  state: StateFrom<MachineType<T>>
) {
  return {
    id: state.context.id,
    shape:
      (state.context.shape as T extends AnnotationType
        ? AnnotationDisplayTypes[T]
        : null) ?? undefined,
  }
}

export function BaseEditPanel<T extends AnnotationType | "null">({
  setActive,
  strategy,
  children,
}: PropsWithChildren<BaseEditPanelProps<T>>) {
  const {
    ref,
    index,
    stateMachine,
    style: { radius, lineWidth },
  } = useAnnotation()
  const { id, shape } = useSelector(stateMachine, selectShapeAndId, isEqual)
  const {
    canvasRef: { current: canvas },
  } = useCanvas()
  const { scale } = useImage()
  const {
    refs,
    setOpen,
    context: floatingContext,
    floatingStyles,
    getReferenceProps,
  } = usePopoverContext()

  const handleToggle = useCallback((open: boolean) => {
    refs.setPositionReference({
      getBoundingClientRect() {
        return strategy.getBoundingClientRect(
          shape as T extends AnnotationType ? AnnotationDisplayTypes[T] : null,
          canvas,
          scale
        )
      },
      contextElement: ref.current ?? undefined,
    })
    setOpen(open)
    open && setActive((prev) => prev.filter((activeId) => activeId === id))
    !open && setActive((prev) => prev.filter((activeId) => activeId !== id))
  }, [])

  const handleMouse = useCallback((e: MouseEvent | WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canvas) return
    const { x, y, a } = clientToImage(e.clientX, e.clientY, canvas)
    x &&
      y &&
      stateMachine.send({
        type: e.type as "mousedown" | "mousemove" | "mouseup",
        mouse: { x: x / scale, y: y / scale },
        button: e.button,
        ...(e.type === "mousemove" && {
          radius: (radius + 8) / scale / a,
          lineWidth: (lineWidth + 16) / scale / a,
        }),
      } as EventFromLogic<MachineType<T>>)
  }, [])

  const handleAttachMouseListeners = useCallback(
    (controller: AbortController) => {
      if (!canvas) return
      console.debug(`EditPanel[${index}]: Attaching edit mouse listeners`)
      canvas.addEventListener("mousemove", handleMouse, {
        signal: controller.signal,
      })
      canvas.addEventListener("mouseup", handleMouse, {
        signal: controller.signal,
      })
    },
    [handleMouse]
  )

  const handleRemoveMouseListeners = useCallback(() => {
    if (!canvas) return
    console.debug(`EditPanel[${index}]: Removing edit mouse listeners`)
    canvas.removeEventListener("mousemove", handleMouse)
    canvas.removeEventListener("mouseup", handleMouse)
  }, [handleMouse])

  useEffect(() => {
    if (!canvas || !stateMachine) return
    const controller = new AbortController()
    canvas.addEventListener("mousedown", handleMouse, {
      signal: controller.signal,
    })

    const initialActive = stateMachine.getSnapshot().matches("active")
    if (initialActive) handleToggle(true)
    let wasActive = initialActive

    const subscription = stateMachine.subscribe((state) => {
      const isNowActive = state.matches("active")
      if (isNowActive !== wasActive) {
        handleToggle(isNowActive)
        wasActive = isNowActive
      }
      strategy.handleSubscription(canvas, state as SnapshotFrom<MachineType<T>>)
      console.debug(`EditService[${index}] state:`, {
        state: state.value,
        ...state.context,
      })
    })
    const attachEditMouse = stateMachine.on("attachMouse", () =>
      handleAttachMouseListeners(controller)
    )
    const detachEditMouse = stateMachine.on(
      "detachMouse",
      handleRemoveMouseListeners
    )

    return () => {
      if (canvas) {
        controller.abort()
        const currentCursor = canvas.className.match(/cursor-[^\s]*/)?.[0]
        currentCursor && canvas.classList.remove(currentCursor)
      }
      subscription.unsubscribe()
      attachEditMouse.unsubscribe()
      detachEditMouse.unsubscribe()
      stateMachine.send({ type: "deactivate" } as EventFromLogic<
        MachineType<T>
      >)
    }
  }, [])

  if (!floatingContext.open) return null

  return (
    <FloatingFocusManager context={floatingContext} modal={false}>
      <div
        className="pointer-events-auto flex flex-col rounded-md bg-slate-900/60"
        ref={refs.setFloating}
        style={floatingStyles}
        {...getReferenceProps()}
      >
        {children}
      </div>
    </FloatingFocusManager>
  )
}
