import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react"
import {
  useCanvas,
  useCanvasRenderingContext,
  type Transform,
} from "@finspotter/canvas"
import { useImage } from "@finspotter/canvas/media"
import { type Annotation } from "../annotation"
import { useActorRef } from "@xstate/react"
import { flushSync } from "react-dom"
import { type Actor, type SnapshotFrom } from "xstate"

import {
  type AnnotationDataTypes,
  type AnnotationDisplayTypes,
  type AnnotationType,
  type MachineType,
} from "../"
import { createSimpleMachine } from "../machine"

const DEFAULTANNOTATIONSTYLE: Required<AnnotationStyle> = {
  lineWidth: 2,
  radius: 8,
  color: "blue",
  glow: false,
}

export type RawAnnotation<T extends AnnotationType | "null"> = {
  type: T extends AnnotationType ? T : null
  data?: T extends AnnotationType ? AnnotationDataTypes[T] : null
} & Omit<Annotation, "data" | "type">

export type DisplayAnnotation<T extends AnnotationType | "null"> = {
  shape?: T extends AnnotationType ? AnnotationDisplayTypes[T] : null
} & RawAnnotation<T>

export type ConvertTo<TTo extends AnnotationType | "null"> = {
  [TFrom in AnnotationType | "null"]?: (
    data: TFrom extends AnnotationType ? AnnotationDataTypes[TFrom] : null
  ) => TTo extends AnnotationType ? Partial<AnnotationDataTypes[TTo]> : null
}

type AnnotationStyle = {
  lineWidth?: number
  radius?: number
  color?: string
  glow?: boolean
}

export interface AnnotationStrategy<T extends AnnotationType | "null"> {
  draw(
    canvas: HTMLCanvasElement,
    state: SnapshotFrom<MachineType<T>> &
      SnapshotFrom<ReturnType<typeof createSimpleMachine<T>>>,
    style: Required<AnnotationStyle>
  ): void
  machine: MachineType<T>
  createInitialState(annotation: RawAnnotation<T>): DisplayAnnotation<T>
  getBoundingClientRect(
    shape:
      | (T extends AnnotationType ? AnnotationDisplayTypes[T] : null)
      | undefined,
    canvas: HTMLCanvasElement | null,
    scale: number
  ): DOMRect
  handleSubscription(
    canvas: HTMLCanvasElement,
    state: SnapshotFrom<MachineType<T>>
  ): void
  convert?: ConvertTo<T>
  getTransformMatrix(
    arg0: T extends AnnotationType ? AnnotationDataTypes[T] : null
  ): Transform
}

export type BaseAnnotationLayerProps<
  T extends AnnotationType | "null" = "null",
  E extends boolean = boolean,
> = {
  index: number
  active: boolean
  annotation: RawAnnotation<T>
  style: AnnotationStyle
  editable: E
  children?: E extends true ? ReactNode : never
  strategy: AnnotationStrategy<T>
}

export function BaseAnnotationLayer<
  T extends AnnotationType | "null",
  E extends boolean,
>({
  index,
  active,
  annotation,
  style,
  editable,
  strategy,
  children,
}: BaseAnnotationLayerProps<T, E>) {
  const {
    canvasRef: { current: canvas },
    withAnimationFrame,
    setRender,
  } = useCanvas()
  const ref = useRef<HTMLDivElement | null>(null)
  useCanvasRenderingContext()
  const { transform, scale } = useImage()
  const ctx = canvas?.getContext("2d")
  const simpleMachine = useMemo(() => createSimpleMachine<T>(), [])
  const { machine, draw, createInitialState } = strategy
  const stateMachine = useActorRef(
    editable
      ? machine.provide({
          actions: {
            render: () => {
              withAnimationFrame(() => {
                flushSync(() => setRender((x) => x + 1))
              })
            },
          },
        })
      : simpleMachine,
    {
      input: createInitialState(annotation),
    }
  ) as E extends true ? Actor<MachineType<T>> : Actor<typeof simpleMachine>
  const state = stateMachine.getSnapshot()

  const annotationContext = useMemo(() => {
    return editable
      ? ({
          ref,
          index,
          style: {
            ...DEFAULTANNOTATIONSTYLE,
            ...style,
          },
          stateMachine,
        } as AnnotationContextProps<T>)
      : undefined
  }, [index])

  if (!canvas || !ctx || !active) return <></>

  ctx.save()
  ctx.transform(
    scale * (transform?.a ?? 1),
    scale * (transform?.b ?? 0),
    scale * (transform?.c ?? 0),
    scale * (transform?.d ?? 1),
    scale * (transform?.e ?? 0),
    scale * (transform?.f ?? 0)
  )
  if (style?.glow) {
    ctx.shadowColor = style.color ?? DEFAULTANNOTATIONSTYLE.color
    ctx.shadowBlur = 12
  }
  draw(
    canvas,
    state as SnapshotFrom<MachineType<T>> &
      SnapshotFrom<ReturnType<typeof createSimpleMachine<T>>>,
    {
      ...DEFAULTANNOTATIONSTYLE,
      ...style,
    }
  )
  ctx.restore()

  if (!editable) return

  return (
    <AnnotationContext.Provider value={annotationContext}>
      <div ref={ref}>{children}</div>
    </AnnotationContext.Provider>
  )
}

export interface AnnotationContextProps<
  T extends AnnotationType | "null" = AnnotationType | "null",
> {
  ref: RefObject<HTMLDivElement | null>
  index: number
  style: Required<AnnotationStyle>
  stateMachine: Actor<MachineType<T>>
}

const AnnotationContext = createContext<AnnotationContextProps | undefined>(
  undefined
)

export function useAnnotation<T extends AnnotationType | "null">() {
  const context = useContext(AnnotationContext)

  if (context === undefined) {
    throw new Error(
      "useAnnotation must be used inside an editable AnnotationLayer"
    )
  }

  return context as AnnotationContextProps<T>
}
