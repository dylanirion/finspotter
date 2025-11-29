import {
  isPointInPolygon,
  type MouseDown,
  type MouseMove,
  type MouseUp,
} from "@finspotter/annotation-bbox_xywh/machine"
import { type DisplayAnnotation } from "@finspotter/annotations/react/BaseAnnotationLayer"
import { eventBus, fromEventBus } from "@finspotter/canvas/machines/EventBus"
import {
  and,
  assertEvent,
  assign,
  emit,
  enqueueActions,
  not,
  sendTo,
  setup,
  type ActorRef,
  type Snapshot,
} from "xstate"

type EventTypes =
  | {
      type:
        | "lock"
        | "unlock"
        | "toggle.edit"
        | "activate"
        | "deactivate"
        | "render"
    }
  | MouseDown
  | MouseMove
  | MouseUp
  | {
      type: "set.category"
      value: string
    }

type ParentActor = ActorRef<Snapshot<unknown>, { type: "render" }>

export const movePointMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      center: { x: number; y: number }
      angle: number
      partIndex: number
      pointIndex: number
    } & Required<Pick<DisplayAnnotation<"segmentation">, "shape" | "data">>,
    events: {} as MouseMove | MouseUp,
    input: {} as {
      parentRef: ParentActor
      partIndex: number
      pointIndex: number
      angle: number
    } & Required<Pick<DisplayAnnotation<"segmentation">, "shape" | "data">>,
    output: {} as Required<
      Pick<DisplayAnnotation<"segmentation">, "shape" | "data">
    >,
  },
  actions: {
    render: sendTo(({ context }) => context.parentRef, {
      type: "render",
    }),
    move: assign({
      shape: ({ context, event }) => movePointAction({ context, event }),
    }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgFssA3MAZTCgLAwBcBZAQwGMALASwzHxAActY7WuywYeAD0QBGAEzoAntJnIVyIA */
  id: "movePointMachine",
  initial: "idle",
  context: ({ input }) => ({
    ...input,
    center: getCenter(input.shape),
  }),
  output: ({ context }) => contextToOutput(context),
  states: {
    idle: {
      on: {
        mousemove: {
          actions: ["move", "render"],
        },
        mouseup: "done",
      },
    },
    done: {
      entry: "render",
      type: "final",
    },
  },
})

export const machine = setup({
  actors: {
    eventBus: fromEventBus(() => eventBus),
    movePointMachine,
  },
  types: {
    context: {} as {
      closestPoint: { partIndex: number; pointIndex: number } | undefined
    } & DisplayAnnotation<"segmentation">,
    events: {} as EventTypes,
    input: {} as DisplayAnnotation<"segmentation">,
  },
  actions: {
    emitAttachMouse: emit({ type: "attachMouse" }),
    emitDetachMouse: emit({ type: "detachMouse" }),
    render: () => {},
  },
  guards: {
    isNotLockEvent: ({ event }) => event.type !== "lock",
    isLeftClick: ({ event }) => {
      assertEvent(event, "mousedown")
      return event.button === 0
    },
    isEventInsidePolygon: ({ context, event }) => {
      assertEvent(event, "mousedown")
      return (
        context.shape?.some((shape) => isPointInPolygon(event.mouse, shape)) ??
        false
      )
    },
    isMissingShape: ({ context }) => !context.shape,
    isOverPoint: ({ context }) => !!context.closestPoint,
  },
}).createMachine({
  id: "segmentationActions",
  initial: "idle",
  context: ({ input }) => ({
    closestPoint: undefined,
    ...input,
  }),
  invoke: {
    id: "eventBus",
    src: "eventBus",
  },
  states: {
    idle: {
      id: "idle",
      always: [
        {
          guard: "isMissingShape",
          target: "active",
        },
      ],
      //TODO: might want to attach move listener and update cursor on hover?
      on: {
        mousedown: {
          guard: and(["isLeftClick", "isEventInsidePolygon"]),
          target: "active",
        },
        activate: "active",
      },
    },
    active: {
      initial: "idle",
      on: {
        "toggle.edit": [
          {
            actions: "render",
            guard: not("isMissingShape"),
            target: ".editing",
          },
          { actions: "render", target: ".editing.newSeg" },
        ],
        "set.category": {
          actions: assign({
            category: ({ event }) => event.value,
          }),
        },
        mousedown: {
          guard: and(["isLeftClick", not("isEventInsidePolygon")]),
          target: "#idle",
        },
        deactivate: "#idle",
      },
      states: {
        idle: {},
        editing: {
          entry: [
            sendTo("eventBus", { type: "lock" }),
            enqueueActions(({ enqueue, check }) => {
              if (check(not("isMissingShape"))) {
                enqueue("emitAttachMouse")
              }
            }),
            "render",
          ],
          exit: [
            enqueueActions(({ enqueue, check }) => {
              if (check("isNotLockEvent")) {
                enqueue.sendTo("eventBus", { type: "unlock" })
              }
            }),
            "emitDetachMouse",
            "render",
          ],
          initial: "idle",
          on: {
            "toggle.edit": "idle",
            mousemove: {
              actions: assign({
                closestPoint: ({ context, event }) =>
                  context.shape
                    ? getClosestPoint(event.mouse, context.shape, event.radius)
                    : undefined,
              }),
            },
          },
          states: {
            idle: {
              on: {
                mousemove: [
                  {
                    guard: "isOverPoint",
                    target: "overPoint",
                  },
                ],
              },
            },
            overPoint: {
              on: {
                mousemove: {
                  guard: not("isOverPoint"),
                  target: "idle",
                },
                mousedown: {
                  guard: "isLeftClick",
                  target: "movePoint",
                },
              },
            },
            newSeg: {
              /*
              invoke: {
                id: "newSeg",
                src: "newSegMachine",
                input: ({ self }) => ({
                  parentRef: self,
                }),
                onDone: {
                  actions: assign({
                    shape: ({ event }) => event.output.shape,
                    data: ({ event }) => event.output.data,
                  }),
                  target: "idle",
                },
              },
              entry: ["emitAttachMouse"],
              on: {
                mousedown: [
                  {
                    guard: "isLeftClick",
                    actions: sendTo("newBox", ({ event }) => event),
                  },
                ],
                mouseup: {
                  actions: sendTo("newBox", ({ event }) => event),
                },
                mousemove: {
                  actions: sendTo("newBox", ({ event }) => event),
                },
                render: { actions: "render" },
              },
              */
            },
            movePoint: {
              invoke: {
                id: "movePoint",
                src: "movePointMachine",
                input: ({ context, self }) => ({
                  parentRef: self,
                  shape: context.shape!,
                  data: context.data!,
                  partIndex: context.closestPoint!.partIndex,
                  pointIndex: context.closestPoint!.pointIndex,
                  angle: 0,
                }),
                onDone: {
                  actions: assign({
                    shape: ({ event }) => event.output.shape,
                    data: ({ event }) => event.output.data,
                  }),
                  target: "overPoint",
                },
              },
              on: {
                mousemove: {
                  actions: sendTo("movePoint", ({ event }) => event),
                },
                mouseup: {
                  actions: sendTo("movePoint", ({ event }) => event),
                },
                render: { actions: "render" },
              },
            },
          },
        },
      },
    },
    locked: {
      on: {
        unlock: { target: "idle" },
      },
    },
  },
})

export function mod(n: number, m: number) {
  return ((n % m) + m) % m
}

export function getCenter(shape: { x: number; y: number }[][]) {
  const center = shape.reduce(
    (acc, part) => {
      const sumX = part.reduce((sum, point) => sum + point.x, 0)
      const sumY = part.reduce((sum, point) => sum + point.y, 0)
      const numPoints = part.length

      return {
        x: (acc.x * acc.count + sumX) / (acc.count + numPoints),
        y: (acc.y * acc.count + sumY) / (acc.count + numPoints),
        count: acc.count + numPoints,
      }
    },
    { x: 0, y: 0, count: 0 }
  )
  return { x: center.x, y: center.y }
}

export function rotatePoint(
  point: { x: number; y: number },
  origin: { x: number; y: number },
  angle: number
) {
  const theta = (angle * Math.PI) / 180
  const sin = Math.sin(theta)
  const cos = Math.cos(theta)
  return {
    x: sin * (point.y - origin.y) + cos * (point.x - origin.x) + origin.x,
    y: cos * (point.y - origin.y) - sin * (point.x - origin.x) + origin.y,
  }
}

//TODO: can this reuse getClosestPoint from other annotation types?
function getClosestPoint(
  mouse: { x: number; y: number },
  shape: { x: number; y: number }[][],
  dist = 8
) {
  let closest: { partIndex: number; pointIndex: number } | undefined = undefined
  dist *= dist
  shape.forEach((part, i) => {
    part.forEach((point, j) => {
      const x = mouse.x - point.x
      const y = mouse.y - point.y
      const d2 = x * x + y * y
      if (d2 < dist) {
        dist = d2
        closest = { partIndex: i, pointIndex: j }
      }
    })
  })
  return closest
}

function contextToOutput(
  context: Required<Pick<DisplayAnnotation<"segmentation">, "shape">>
): Required<Pick<DisplayAnnotation<"segmentation">, "shape" | "data">> {
  const { shape } = context
  return {
    shape: shape.map((part) =>
      part.map(({ x, y }) => ({ x: roundToTwo(x), y: roundToTwo(y) }))
    ),
    data: shape.map((part) =>
      part.flatMap(({ x, y }) => [roundToTwo(x), roundToTwo(y)])
    ),
  }
}

export const roundToTwo = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100

export function movePointAction({
  context,
  event,
}: {
  context: {
    shape: { x: number; y: number }[][]
    partIndex: number
    pointIndex: number
    center: { x: number; y: number }
    angle: number
  }
  event: MouseMove | MouseUp
}) {
  assertEvent(event, "mousemove")
  const { shape, partIndex, pointIndex, center, angle } = context
  const { mouse } = event
  const unrotatedMouse = rotatePoint(mouse, center, -angle)
  const unrotatedShape = shape.map((part) =>
    part.map((p) => rotatePoint(p, center, -angle))
  )

  unrotatedShape[partIndex][pointIndex] = unrotatedMouse

  return unrotatedShape.map((part) =>
    part.map((p) => rotatePoint(p, center, angle))
  )
}
