import {
  getCenter,
  getClosestPoint,
  getClosestSegment,
  isPointInPolygon,
  mod,
  moveBoxCornerAction,
  moveBoxSideAction,
  rotatePoint,
  roundToTwo,
  type EventTypes,
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

type ParentActor = ActorRef<Snapshot<unknown>, { type: "render" }>

export const moveCornerMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      center: { x: number; y: number }
      angle: number
      index: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>,
    events: {} as MouseMove | MouseUp,
    input: {} as {
      parentRef: ParentActor
      index: number
      angle: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>,
    output: {} as Required<
      Pick<DisplayAnnotation<"bbox_xywha">, "shape" | "data">
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
    } & Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>,
    events: {} as MouseMove | MouseUp,
    input: {} as {
      parentRef: ParentActor
      index: number
      angle: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>,
    output: {} as Required<
      Pick<DisplayAnnotation<"bbox_xywha">, "shape" | "data">
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

export const rotateBoxMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      center: { x: number; y: number }
      last: { x: number; y: number }
      angle: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>,
    events: {} as MouseMove | MouseUp,
    input: {} as {
      parentRef: ParentActor
      last: { x: number; y: number }
      angle: number
    } & Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>,
    output: {} as Required<
      Pick<DisplayAnnotation<"bbox_xywha">, "shape" | "data">
    >,
  },
  actions: {
    render: sendTo(({ context }) => context.parentRef, {
      type: "render",
    }),
    move: assign(({ context, event }) => rotateBoxAction({ context, event })),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgFssA3MAZTCgLAwBcBZAQwGMALASwzHxAActY7WuywYeAD0QBGAEzoAntJnIVyIA */
  id: "rotateBoxMachine",
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
      clicks?: { x: number; y: number }[]
      mouse?: { x: number; y: number }
    } & Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>,
    events: {} as MouseMove | MouseDown | MouseUp,
    input: {} as {
      parentRef: ParentActor
    },
    output: {} as Required<
      Pick<DisplayAnnotation<"bbox_xywha">, "shape" | "data">
    >,
  },
  actions: {
    render: sendTo(({ context }) => context.parentRef, {
      type: "render",
    }),
    setClicks: assign({
      clicks: ({ context, event }) => {
        assertEvent(event, "mousedown")
        const { clicks } = context
        const { mouse } = event
        if (!clicks) return [{ x: mouse.x, y: mouse.y }]
        else return [...clicks, { x: mouse.x, y: mouse.y }]
      },
    }),
    placeVirtual: assign({
      shape: ({ context, event }) => {
        assertEvent(event, "mousemove")
        const { shape, clicks } = context
        if (!clicks) return shape
        const { mouse } = event
        const [xc, yc] = [
          (clicks[0].x + clicks[1].x) / 2,
          (clicks[0].y + clicks[1].y) / 2,
        ]
        const dx = clicks[1].x - clicks[0].x
        const dy = clicks[1].y - clicks[0].y
        const halfHeight = Math.hypot(dx, dy) / 2
        const angleRadians = Math.atan2(dx, dy)
        const dirX = Math.sin(angleRadians)
        const dirY = Math.cos(angleRadians)
        const mouseVectorX = mouse.x - xc
        const mouseVectorY = mouse.y - yc
        const projection = mouseVectorX * dirX + mouseVectorY * dirY
        const perpX = mouseVectorX - projection * dirX
        const perpY = mouseVectorY - projection * dirY
        const halfWidth = Math.hypot(perpX, perpY)
        const corners = [
          { x: -halfWidth + xc, y: halfHeight + yc }, // bottom left
          { x: -halfWidth + xc, y: -halfHeight + yc }, // top left
          { x: halfWidth + xc, y: -halfHeight + yc }, // top right
          { x: halfWidth + xc, y: halfHeight + yc }, // bottom right
        ]
        return corners.map((corner) =>
          rotatePoint(corner, { x: xc, y: yc }, (angleRadians * 180) / Math.PI)
        )
      },
    }),
  },
  guards: {
    hasFirstPoint: ({ context }) => context.clicks?.length === 1,
    hasSecondPoint: ({ context }) => context.clicks?.length === 2,
    hasFourPoints: ({ context }) => context.shape.length === 4,
    mouseHasMoved: ({ context, event }) => {
      assertEvent(event, "mousemove")
      return (
        context?.mouse?.x !== event.mouse.x ||
        context?.mouse?.y !== event.mouse.y
      )
    },
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
        mousedown: { actions: ["setClicks", "render"] },
        mousemove: [
          {
            guard: and(["hasSecondPoint", "mouseHasMoved"]),
            actions: [
              assign({
                mouse: ({ event }) => event.mouse,
              }),
              "placeVirtual",
              "render",
            ],
          },
          {
            guard: "hasFirstPoint",
            actions: [
              assign({
                mouse: ({ event }) => event.mouse,
              }),
              "render",
            ],
          },
          {
            actions: [
              assign({
                mouse: ({ event }) => event.mouse,
              }),
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

//TODO: get BaseMachine and extend
export const machine = setup({
  actors: {
    eventBus: fromEventBus(() => eventBus),
    moveSideMachine,
    moveCornerMachine,
    newBoxMachine,
    rotateBoxMachine,
  },
  types: {
    context: {} as {
      closestPoint: [number] | undefined
      closestSegment: [number] | undefined
    } & DisplayAnnotation<"bbox_xywha">,
    events: {} as EventTypes,
    input: {} as DisplayAnnotation<"bbox_xywha">,
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
      assertEvent(event, ["mousemove", "mousedown"])
      return isPointInPolygon(event.mouse, context.shape)
    },
    isMissingShape: ({ context }) => !context.shape,
    isOverPoint: ({ context }) => !!context.closestPoint,
    isOverSegment: ({ context }) => !!context.closestSegment,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QCNkHsAeANAmgdQAkBBAYwBcBLNAO1gDoKIAbMAYgFs0BXWSNAd2oBtAAwBdRKAAOaWBUo1JIDIgDMADgCcdVQEYATAFYRmgOy71x0+oAsAGhABPRLr2q611atOr9Nk+oaAL5BDqiYuISkCrQMzGwAhuQUAG4JZGCiEkggMnIxSioIqpraekYm5pYi1vZOLqoAbDZ0+oHeNo2ahroiuiFh6Nj4xMk09IwsrFlKefJU1IVqpToGxmYWVrYOzgi6Nvse7aaN+5r6FvoDIOHDUWOxSZQpbGRoUFAsdJDyMzlzBRyRWaIjoIk6Wl0PlUhlOdV2rlcdH8gR86gMfhsV1CNyGkVGMXoT1Sr3enzA3wgv102WksnmiiBiBBYIhmihXlh+x2LgujToukMqJEhnOBz011u+OiCyJyRerF4ZDoJHSYCgaAATo4-nT8gslntGo1TAKKjZIaKNPCXOtWsZwRaDoZTCdJXiRjLxnRiQrODw+IJdbl6YDQEUmmU1pVNjVtvU9m06A6RCJfCbwfo3TipZ6HnLnmwIGBfWrgwCDUziqYoxUNtVajy9jWwanUzZTBdBaUbO6InnCT75RSfpRqFBWG8Pl9R+XQ5Xw4gjOZkRdunpGiKfI0mwZTKC015zB3DFm+3cCbKh4XKfNxxxuLxOC85-rGYujep9HRGrD9KU3C6RpVF3DRvzbcFdEaC5TE6VRz2lfNrxJW8xygOIpn9J80BfcRZnnd9lFtERv30NMoOsUwhUdXcs2-FMSjaVMemxQZ+3uQdfRHKk0IwtgsLAZ9MhpfC30WKtBRI1pyJNdQqPUGiEzk0EKhI4D2TaLEEIHK8uNQihxzoHCwE1AAFNADLIB8AyE18GXEj8oLTH9zHOKERC-ERTlo-RwLbbwvytYIcw9DjdOHfTDOMsyLOoKyBIgARhDw-4CIcoi9k0YDk00DQPPFHxfNoqjW1TRiFJFAxtLC709NHAz0OigBldV2DAOLrOw3DaRDMTDSc9wTV0Nz9087ylOGjwHT8XLzGNTRqsvWqIvqqKXk1FqoDajqEqSuywwy4bsqtBTbFcQr9CbOTvyo1N9HUgxbFY3F2KWx4Vp4hq6GoMB+AAIUwVhEp+hhqBSNAAGsKR+-7MH2hdDt80F9i80V1GNGFjVo7wwVuvKoVONpFq9d6b1W9CYYBjBOsDZKeorQiiiylpAlFYCO00Lz1F3AxQX3MqsRsQx-Gg4mkLqz7DMpwGBK4KR4cZlw+m0CFXQUrEel3Ej3CFsreiMF1DDFziPrvCnfqpmnbJSvV7P61NtB6WFT2NX85NMJtzn5Mi7usLcbGCtiLxJgsUPJ76LcBzV2uLTUFfSop9ZaMi9EMXwLl8G0EC-dQ6G6O6hcsDTTGN8Kycl9ChKaxgixoCkDPBqG6Crmv48NFPTXu2F0aOruPYTNXkzbfRfFsE4TFL5by7N5vjOr4sreMtuq18hSdAD9FNAD-8jqbW7SpI1eNCoyfSbDivZ5eef+MfMA5eXj9fM51osq3i0PKeptfxuh1hq8-wN6n1Di8SKlc5411YNHagscH4ZSfoYMEbhhqaDkr+HcCZDCYKHqmQUtgsR7iAchEB4chIAGEtQ-U1EDOuoNG4UjIRQkysCihkV8nnNcmNhYsX7giCwfMHRNA5KeGshCJYzwYZqShi9uqiTtivf8LRGhyVhKUWCJo-A81PPaMqPROzNChKI02vEJFSNlvLG2vU5GP1UOCH8It1zGFFIYLWWCIJ6G6G0Xo6hDHT2McZchkiTKQJjkwixDME5LhsWUW6+5Txbw8jwxA3RTS3RInJXwZgsqEKYGgEgUMICsC4NQHJeTmEuBsNoCCaY2iiizF4UCKDEFHkwTWNOUEQg4moGgYs8Aci5hqrQWRB0igAFp0G7BGQg0o0yZkzIDoQyYYAhkIxYS6VYFRmi+GokLBpuc07NJdOudpIVXohyIUs1KfUqy1NZEo9k0IuRZxTtg1MpwqJZn3I0HxKFFnLMVggLMHk7E1BqCULQ65iqgn2d4fY7yS4nODuLIxDU-kROzucRBe5jBYguP+JsO8D41GNHNJo8EEWIRNr4r6vzLlWMOt4FSMlC4oNdLoWiopkQCPULYDQxyg4UrLufGe0VzKWVRf1L8-JjQHCgko6CNTaImmRBRLc4ImidG+cQi+zVWrtTIOKiS6IWh9FhJRDyxhxq7HRgg2VXRPGYMyZq7iM9pZFFtsMpJ-hMVZmxb5AwmgfLfnzmmNRp5vBOtAZfMA18DWP2QWCXK6JgL6KxkpLRqkDYhq8v0clOkp5Cr8S8AJlDY1wPjSYXlyaDipoREYFoDFAhih8Nk3J+TS1FCxLs5MXhvAtKOV8jpQA */
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
                  {
                    guard: not("isEventInsideBox"),
                    target: "outsideBox",
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
            outsideBox: {
              on: {
                mousemove: {
                  guard: "isEventInsideBox",
                  target: "idle",
                },
                mousedown: {
                  guard: and(["isLeftClick", not("isEventInsideBox")]),
                  target: "rotateBox",
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
                  index: context.closestSegment![0],
                  angle: context.data![4],
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
                  index: context.closestPoint![0],
                  angle: context.data![4],
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
            rotateBox: {
              invoke: {
                id: "rotateBox",
                src: "rotateBoxMachine",
                input: ({ context, event, self }) => {
                  assertEvent(event, "mousedown")
                  return {
                    parentRef: self,
                    shape: context.shape!,
                    last: event.mouse,
                    angle: context.data![4],
                  }
                },
                onDone: {
                  actions: assign({
                    shape: ({ event }) => event.output.shape,
                    data: ({ event }) => event.output.data,
                  }),
                  target: "outsideBox",
                },
              },
              on: {
                mousemove: {
                  actions: sendTo("rotateBox", ({ event }) => event),
                },
                mouseup: {
                  actions: sendTo("rotateBox", ({ event }) => event),
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

const getDistanceBetweenPoints = (
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

const getAngleFromVertical = (
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) => {
  return Math.atan2(p2.x - p1.x, p2.y - p1.y)
}

const findCenter = (
  shape: Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>["shape"]
) => {
  const xc = shape.reduce((sum, point) => sum + point.x, 0) / 4
  const yc = shape.reduce((sum, point) => sum + point.y, 0) / 4
  return { x: xc, y: yc }
}

function contextToOutput(
  context: Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape">>
): Required<Pick<DisplayAnnotation<"bbox_xywha">, "shape" | "data">> {
  const { shape } = context
  const [bl, tl, tr, br] = shape
  const { x: xc, y: yc } = findCenter(shape)
  const width =
    (getDistanceBetweenPoints(bl, br) + getDistanceBetweenPoints(tl, tr)) / 2
  const height =
    (getDistanceBetweenPoints(bl, tl) + getDistanceBetweenPoints(br, tr)) / 2
  const angle = (getAngleFromVertical(tl, bl) * 180) / Math.PI
  return {
    shape: shape.map(({ x, y }) => ({ x: roundToTwo(x), y: roundToTwo(y) })),
    data: [xc, yc, width, height, angle].map((val) => roundToTwo(val)) as [
      number,
      number,
      number,
      number,
      number,
    ],
  }
}

export function rotateBoxAction({
  context,
  event,
}: {
  context: {
    shape: { x: number; y: number }[]
    center: { x: number; y: number }
    last: { x: number; y: number }
    angle: number
  }
  event: MouseMove | MouseUp
}) {
  assertEvent(event, "mousemove")
  const { shape, center, last, angle } = context
  const { mouse } = event
  const deltaRad =
    getAngleFromVertical(center, mouse) - getAngleFromVertical(center, last)
  const deltaDeg = (deltaRad * 180) / Math.PI
  const newAngle = angle - deltaDeg
  return {
    last: event.mouse,
    angle: newAngle,
    shape: shape.map((p) => rotatePoint(p, center, mod(deltaDeg, 360))),
  }
}
