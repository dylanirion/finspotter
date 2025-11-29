import { type DisplayAnnotation } from "@finspotter/annotations/react/BaseAnnotationLayer"
import { eventBus, fromEventBus } from "@finspotter/canvas/machines/EventBus"
import { and, assertEvent, emit, not, sendTo, setup } from "xstate"

type EventTypes =
  | { type: "lock" | "unlock" | "activate" | "deactivate" }
  | {
      type: "mousedown"
      mouse: { x: number; y: number }
      button: number
    }

//TODO: get BaseMachine and extend
export const machine = setup({
  actors: {
    eventBus: fromEventBus(() => eventBus),
  },
  types: {
    context: {} as {
      mouse: { x: number; y: number }
      lastMouse: { x: number; y: number }
    } & DisplayAnnotation<"bbox_xywha$segmentation">,
    events: {} as EventTypes,
    input: {} as DisplayAnnotation<"bbox_xywha$segmentation">,
  },
  actions: {
    emitToggle: emit({ type: "toggle" }),
    render: () => {},
  },
  guards: {
    isLeftClick: ({ event }) => {
      assertEvent(event, "mousedown")
      return event.button === 0
    },
    isEventInsideBox: ({ context, event }) => {
      assertEvent(event, "mousedown")
      return isPointInPolygon(event.mouse, context.shape?.bbox_xywha)
    },
  },
}).createMachine({
  id: "bboxXYWHASegmentationActions",
  initial: "idle",
  context: ({ input }) => ({
    mouse: { x: 0, y: 0 },
    lastMouse: { x: 0, y: 0 },
    ...input,
  }),
  invoke: {
    id: "eventBus",
    src: "eventBus",
  },
  on: {
    lock: { target: ".locked" },
    idle: {
      target: ".idle",
    },
  },
  states: {
    idle: {
      id: "idle",
      on: {
        mousedown: {
          guard: and(["isLeftClick", "isEventInsideBox"]),
          target: "active",
        },
        activate: "active",
      },
    },
    active: {
      entry: ["emitToggle"],
      initial: "idle",
      on: {
        "toggle.edit": ".editing",
        mousedown: {
          guard: and(["isLeftClick", not("isEventInsideBox")]),
          target: "#idle",
        },
      },
      states: {
        idle: {},
        editing: {
          initial: "idle",
          entry: [sendTo("eventBus", { type: "lock" })],
          states: {
            idle: {},
          },
          exit: [sendTo("eventBus", { type: "unlock" })],
        },
      },
      exit: ["emitToggle"],
    },
    locked: {
      on: {
        unlock: { target: "idle" },
      },
    },
  },
})

function isPointInPolygon(
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
