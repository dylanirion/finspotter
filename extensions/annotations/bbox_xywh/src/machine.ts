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

export type MouseDown = {
  type: "mousedown"
  mouse: { x: number; y: number }
  button: number
}

export type MouseMove = {
  type: "mousemove"
  mouse: { x: number; y: number }
  radius: number
  lineWidth: number
}

export type MouseUp = { type: "mouseup" }

export type EventTypes =
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

export const moveCornerMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      center: { x: number; y: number }
      angle: number
      index: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywh">, "shape" | "data">>,
    events: {} as MouseMove | MouseUp,
    input: {} as {
      parentRef: ParentActor
      index: number
      angle: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywh">, "shape" | "data">>,
    output: {} as Required<
      Pick<DisplayAnnotation<"bbox_xywh">, "shape" | "data">
    >,
  },
  actions: {
    render: sendTo(({ context }) => context.parentRef, {
      type: "render",
    }),
    move: assign({
      shape: ({ context, event }) => moveBoxCornerAction({ context, event }),
    }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgFssA3MAZTCgLAwBcBZAQwGMALASwzHxAActY7WuywYeAD0QBGAEzoAntJnIVyIA */
  id: "moveCornerMachine",
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

export const moveSideMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      center: { x: number; y: number }
      angle: number
      index: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywh">, "shape">>,
    events: {} as MouseMove | MouseUp,
    input: {} as {
      parentRef: ParentActor
      index: number
      angle: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywh">, "shape">>,
    output: {} as Required<
      Pick<DisplayAnnotation<"bbox_xywh">, "shape" | "data">
    >,
  },
  actions: {
    render: sendTo(({ context }) => context.parentRef, {
      type: "render",
    }),
    move: assign({
      shape: ({ context, event }) => moveBoxSideAction({ context, event }),
    }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgFssA3MAZTCgLAwBcBZAQwGMALASwzHxAActY7WuywYeAD0QBGAEzoAntJnIVyIA */
  id: "moveSideMachine",
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

export const newBoxMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      firstClick?: { x: number; y: number }
      mouse?: { x: number; y: number }
    } & Required<Pick<DisplayAnnotation<"bbox_xywh">, "shape">>,
    events: {} as MouseMove | MouseDown | MouseUp,
    input: {} as {
      parentRef: ParentActor
    },
    output: {} as Required<
      Pick<DisplayAnnotation<"bbox_xywh">, "shape" | "data">
    >,
  },
  actions: {
    render: sendTo(({ context }) => context.parentRef, {
      type: "render",
    }),
    placeCorner: assign({
      firstClick: ({ context, event }) => {
        assertEvent(event, "mousedown")
        const { firstClick } = context
        const { mouse } = event
        if (!firstClick) return { x: mouse.x, y: mouse.y }
        else return firstClick
      },
    }),
    placeVirtual: assign({
      shape: ({ context, event }) => {
        assertEvent(event, "mousemove")
        const { shape, firstClick } = context
        if (!firstClick) return shape
        const { x, y } = firstClick
        const { mouse } = event
        switch (true) {
          case mouse.x > x && mouse.y < y:
            return [firstClick, { x, y: mouse.y }, mouse, { x: mouse.x, y }]
          case mouse.x > x && mouse.y > y:
            return [{ x, y: mouse.y }, firstClick, { x: mouse.x, y }, mouse]
          case mouse.x < x && mouse.y < y:
            return [{ x: mouse.x, y }, mouse, { x, y: mouse.y }, firstClick]
          case mouse.x < x && mouse.y > y:
            return [mouse, { x: mouse.x, y }, firstClick, { x, y: mouse.y }]
          default:
            return shape
        }
      },
    }),
  },
  guards: {
    hasFirstPoint: ({ context }) => !!context.firstClick,
    hasFourPoints: ({ context }) => context.shape.length === 4,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgFssA3MAZTCgLAwBcBZAQwGMALASwzHxAActY7WuywYeAD0QBGAEzoAntJnIVyIA */
  id: "newBoxMachine",
  initial: "idle",
  context: ({ input }) => ({
    ...input,
    shape: [],
  }),
  output: ({ context }) => contextToOutput(context),
  states: {
    idle: {
      on: {
        mousedown: { actions: ["placeCorner", "render"] },
        mousemove: [
          {
            guard: "hasFirstPoint",
            actions: [
              assign({
                mouse: ({ event }) => event.mouse,
              }),
              "placeVirtual",
              "render",
            ],
          },
        ],
        mouseup: [{ guard: "hasFourPoints", target: "done" }],
      },
    },
    done: {
      entry: "render",
      type: "final",
    },
  },
})

//TODO: get BaseMachine and extend?
//most of this will be generic, except for context type, some guards and child actors
export const machine = setup({
  actors: {
    eventBus: fromEventBus(() => eventBus),
    moveSideMachine,
    moveCornerMachine,
    newBoxMachine,
  },
  types: {
    context: {} as {
      closestPoint: [number] | undefined
      closestSegment: [number] | undefined
    } & DisplayAnnotation<"bbox_xywh">,
    events: {} as EventTypes,
    input: {} as DisplayAnnotation<"bbox_xywh">,
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
    isEventInsideBox: ({ context, event }) => {
      assertEvent(event, "mousedown")
      return isPointInPolygon(event.mouse, context.shape)
    },
    isMissingShape: ({ context }) => !context.shape,
    isOverPoint: ({ context }) => !!context.closestPoint,
    isOverSegment: ({ context }) => !!context.closestSegment,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QCNkHsAeANAmgdQAkBBAYwBcBLNAO1gDoKIAbMAYgFs0BXWSNAd2oBtAAwBdRKAAOaWBUo1JIDIgAsARgBsdVQE59m3QCYjAdkMBWADQgAnoiO6AHHVMWR606vebNTjwC+ATaomLiEpAq0DMxsAIbkFABucWRgohJIIDJyUUoqCKoi2noGxmaWNvYI6noidOW1Trre6hZOTkEh6Nj4xIk09IwsrBlKOfJU1PmIAMy6JfoL5ea61naIbRo6Jm1GHU6aZl0gob0RA9EJlElsZGhQUCx0kPJjWRN5WQWaXnQiulmvwBJiMqlm62q6lB-yMFjcxicsxEHlUJzO4X6UXo12SdweTzALwgb3UmWkskmim+iF+qn+gOB5TBEKqm2h2hEpiMmnmqiMHnUEPRPUxkSmOMSt1YvDIdBIqTAUDQACdbO8KbkpjMakdTHQtEVvBYIZoLEY2brTOo6L8TCiTb4RBYRWE+uLBnRcdLODw+IINdlKV9QAV+YsyiZVpDNvs6O4UbM2nrvCZXecsRKvVK2BAwN7FYHPtqaYUeToloYo5UNjVTLp-ijPHDZnpVJotOmxZdJTcia9KNQoKx7o9ngOi8GS6HaU56QCgaYQSZwTGau0G822gCtM1HF33T3s33iZMhxxuLxOLdJ1rqTOaroRLMdJod4ZdOpP15LUK-kYv2fdRnSKZ0DwubFjzxU9BygGIRl9K80BvcRxine9lE2eEbSA-ZgK5N9zV-Hl6WtJ9gPbX5ZlmTpglOUVD0g71+xJWD4LYRCwGvdIyTQu9plLNprX+JM8JRcxnQtWtDm0CE1l+XQlzcTs6IxRis2YmCKCHOhkLAFUAAU0G0sgLz9bjbypASH13G0jgsLRPEdDRiNqOgAKfc0vzWYCXVUhiII0nMtJ0vTDOM6hTM4iABGEVCPnQ6zMIQAULHpBZmlArQBWKYjfncwCKN8UxqNo7o3UCz1NIHbS4LCgBlJV2DASKzKQlDySDfidVs20W1UAb2g7JxTEtJw2joJwLAWAElwhPDwMzKrgpq0LbhVRqoGa1rotiyyQ2S1L0r8FomyOFFNDGvxJumiwFKUhzNEWj0rhW1jaroagwH4AAhTBWBir6GGoJI0AAayJL7fswfbp2SjkXGtQ5ilMEbAW8YjHAafkBv8CFvGFfyKqW16T1WuCob+jA2v9OLOuLDCCnw+pPF3OcNAA-lf3UNyALu9wkQcoUyvo4mXt7aDyc+76qZprgpFhxnNmdFwZokoo2nmWZfw8FweSMVsnB5blVEOZ6j2q96dMp-7OIs+LNSsnqRFNnRZhKr9gPrIVLXKOhkRaHngMBGjZnNpi3rPCmZf+lUWrzFVFaSpnilIvQpuaM0OhNMby1NVQSp8-l63DoKyatuDuPqxhcxoIltNBiG6Crmuk51ADZiMSan1MVHeQ7NxLV7iwGlT6b-CFDw-PKjNxag24QsrvTq7zGn7fpxL25olwC+BQ4FnmeEh4LnRiho+ERvGjtS+W8uo+b5ea7lhWHa6p3SwN-RG1RJYURMS0zQ2gJrjI4+hig31JpLCuD9bgrzYHHagCc24fyNK4ZoQkBTqDRtrWsFg8HxkTPscwS4sHqAgRLBeUtuIAGFVRfRVADOuwNG5EhoXQ-SyCHwAU8JNcExhfjTX5Dybm-4zRkWmiYRS5D54sXvmwlU9C156U4YdIoL5zQQnHlGEa3NvCuDNJoY0qMjZkKJrPC2kc2LyMUZxeWKiChgjci7JcgpDRClUDrPQk1oStmRMHPBIs1KVUgZQ6B1j9KsAQUg1+DNk4OA0A2JEb4RBIn2GYZ0vsTQ3VOu0E0LtzTSKYGgEgEMICsC4NQIpJT7GbDfA0JYS5nDGG9k4X8RQCEXWovsVOLsgh0WoGgPM8AshBJJsMx2B0CgAFpLq1hmdI4YYA+Lvy4dyCsSwjY0Q0PCDxtZag4SbACFE4IUntmkcxZZkzaTlgXEyUEq5LQCnUU2cwBc5y1HAWY7sEcTyLMuXDAoRsR5zR5sic0UYcFQg3LabkX4zSAj-EYc5ljar-KVggfh8Z2zEINo4Hk6hHmfm-gBfwU1nCo2nqLcxPyoH3z+Qlbqgli4iR5mYJM1FTazKhHCOyhgRCSMOHdUwyK75sTCkZEyaK4mPmhLaTwA1soeGRFJbl01bSmjnCkjovIkVfPUrfWlYr1qbW2mQKVPVmiIywc4fWikazVEODaCoPNFLNDuvuPVwSKGyLYjbAoEyAWIEUvSNKvw7Sd34QSvZfMDQnRNEURwJdPVjJkYvGBYA4Hmo-sq7uXI0oDQWHgsars5J+EFndK+IrDUfXCSqLNXCc3NDzQNPQZo1zQnbK4a1ptai+EOLqme3ysxVNKfW5KXM9nbBRB4I5LtkRzj6QEIAA */
  id: "bboxXYWHActions",
  initial: "idle",
  context: ({ input }) => ({
    closestPoint: undefined,
    closestSegment: undefined,
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
          guard: and(["isLeftClick", "isEventInsideBox"]),
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
          { actions: "render", target: ".editing.newBox" },
        ],
        "set.category": {
          actions: assign({
            category: ({ event }) => event.value,
          }),
        },
        mousedown: {
          guard: and(["isLeftClick", not("isEventInsideBox")]),
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
                closestSegment: ({ context, event }) =>
                  context.shape
                    ? getClosestSegment(
                        event.mouse,
                        context.shape,
                        event.lineWidth,
                        event.radius
                      )
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
                  {
                    guard: "isOverSegment",
                    target: "overSegment",
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
                  target: "moveCorner",
                },
              },
            },
            overSegment: {
              on: {
                mousemove: {
                  guard: not("isOverSegment"),
                  target: "idle",
                },
                mousedown: {
                  guard: and(["isLeftClick", "isOverSegment"]),
                  target: "moveSide",
                },
              },
            },
            newBox: {
              invoke: {
                id: "newBox",
                src: "newBoxMachine",
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
            },
            moveSide: {
              invoke: {
                id: "moveSide",
                src: "moveSideMachine",
                input: ({ context, self }) => ({
                  parentRef: self,
                  shape: context.shape!,
                  data: context.data!,
                  index: context.closestSegment![0],
                  angle: 0,
                }),
                onDone: {
                  actions: assign({
                    shape: ({ event }) => event.output.shape,
                    data: ({ event }) => event.output.data,
                  }),
                  target: "overSegment",
                },
              },
              on: {
                mousemove: {
                  actions: sendTo("moveSide", ({ event }) => event),
                },
                mouseup: {
                  actions: sendTo("moveSide", ({ event }) => event),
                },
                render: { actions: "render" },
              },
            },
            moveCorner: {
              invoke: {
                id: "moveCorner",
                src: "moveCornerMachine",
                input: ({ context, self }) => ({
                  parentRef: self,
                  shape: context.shape!,
                  data: context.data!,
                  index: context.closestPoint![0],
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
                  actions: sendTo("moveCorner", ({ event }) => event),
                },
                mouseup: {
                  actions: sendTo("moveCorner", ({ event }) => event),
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

export function getCenter(shape: { x: number; y: number }[]) {
  // assumes [bottom-left, top-left, top-right, bottom-right]
  return {
    x: (shape[0].x + shape[2].x) / 2,
    y: (shape[0].y + shape[2].y) / 2,
  }
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

// might be worth checking performance of these vs. ctx.isPointinPath, ctx.isPointinStroke
export function getClosestPoint(
  mouse: { x: number; y: number },
  points: { x: number; y: number }[],
  dist = 8
) {
  let closestIndex: [number] | undefined = undefined
  dist *= dist
  points.forEach((point, i) => {
    const x = mouse.x - point.x
    const y = mouse.y - point.y
    const d2 = x * x + y * y
    if (d2 < dist) {
      dist = d2
      closestIndex = [i]
    }
  })
  return closestIndex
}

export function getClosestSegment(
  mouse: { x: number; y: number },
  points: { x: number; y: number }[],
  dist = 2,
  end = 8
) {
  let closestIndex: [number] | undefined = undefined
  dist = dist / 2
  for (let from = 0; from < points.length; from++) {
    //point line distance
    const to = (from + 1) % points.length
    const a = points[to].y - points[from].y
    const b = points[from].x - points[to].x
    const c = -(a * points[from].x + b * points[from].y)
    const len = Math.hypot(a, b)
    const d2 = Math.abs(a * mouse.x + b * mouse.y + c) / len
    if (d2 < dist) {
      //project mouse onto line segment
      const t =
        ((mouse.x - points[from].x) * -b + (mouse.y - points[from].y) * a) /
        (len * len)
      if (t >= end / (2 * len) && t <= 1 - end / (2 * len)) {
        dist = d2
        closestIndex = [from]
      }
    }
  }
  return closestIndex
}

export function isPointInPolygon(
  point: { x: number; y: number },
  polygon: { x: number; y: number }[] | undefined
): boolean {
  if (!polygon) return false
  const numVertices = polygon.length
  let inside = false

  for (let i = 0, j = numVertices - 1; i < numVertices; j = i++) {
    const { x: xi, y: yi } = polygon[i]
    const { x: xj, y: yj } = polygon[j]

    // Check if point lies above the lower y coordinate and below the higher one
    if (
      yi > point.y !== yj > point.y &&
      point.x <= ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside
    }
  }

  return inside
}

function contextToOutput(
  context: Required<Pick<DisplayAnnotation<"bbox_xywh">, "shape">>
): Required<Pick<DisplayAnnotation<"bbox_xywh">, "shape" | "data">> {
  const { shape } = context
  const { x, y } = shape[1]
  const width = shape[3].x - x
  const height = shape[3].y - y
  return {
    shape: shape.map(({ x, y }) => ({ x: roundToTwo(x), y: roundToTwo(y) })),
    data: [x, y, width, height].map((val) => roundToTwo(val)) as [
      number,
      number,
      number,
      number,
    ],
  }
}

export const roundToTwo = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100

export function moveBoxCornerAction({
  context,
  event,
}: {
  context: {
    shape: { x: number; y: number }[]
    index: number
    center: { x: number; y: number }
    angle: number
  }
  event: MouseMove | MouseUp
}) {
  assertEvent(event, "mousemove")
  const { shape, index, center, angle } = context
  const { mouse } = event
  const base = mod(index - 1, shape.length)
  const altitude = (index + 1) % shape.length
  const isBaseHorizontal = index % 2 === 0
  const unrotatedMouse = rotatePoint(mouse, center, -angle)
  const unrotatedShape = shape.map((p) => rotatePoint(p, center, -angle))

  unrotatedShape[index] = unrotatedMouse
  unrotatedShape[base] = {
    x: isBaseHorizontal ? unrotatedShape[base].x : unrotatedMouse.x,
    y: isBaseHorizontal ? unrotatedMouse.y : unrotatedShape[base].y,
  }
  unrotatedShape[altitude] = {
    x: isBaseHorizontal ? unrotatedMouse.x : unrotatedShape[altitude].x,
    y: isBaseHorizontal ? unrotatedShape[altitude].y : unrotatedMouse.y,
  }

  return unrotatedShape.map((p) => rotatePoint(p, center, angle))
}

export function moveBoxSideAction({
  context,
  event,
}: {
  context: {
    shape: { x: number; y: number }[]
    index: number
    center: { x: number; y: number }
    angle: number
  }
  event: MouseMove | MouseUp
}) {
  assertEvent(event, "mousemove")
  const { shape, index, center, angle } = context
  const { mouse } = event

  const unrotatedMouse = rotatePoint(mouse, center, -angle)
  const unrotatedShape = shape.map((p) => rotatePoint(p, center, -angle))

  const isVertical = index % 2 === 0
  const i1 = index
  const i2 = (index + 1) % shape.length

  const midpoint = {
    x: (unrotatedShape[i1].x + unrotatedShape[i2].x) / 2,
    y: (unrotatedShape[i1].y + unrotatedShape[i2].y) / 2,
  }

  const delta = {
    x: isVertical ? unrotatedMouse.x - midpoint.x : 0,
    y: isVertical ? 0 : unrotatedMouse.y - midpoint.y,
  }

  const newShape = [...unrotatedShape]
  for (const i of [i1, i2]) {
    newShape[i] = {
      x: newShape[i].x + delta.x,
      y: newShape[i].y + delta.y,
    }
  }

  return newShape.map((p) => rotatePoint(p, center, angle))
}
