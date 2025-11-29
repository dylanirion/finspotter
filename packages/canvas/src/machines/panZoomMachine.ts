import { assign, enqueueActions, sendTo, setup } from "xstate"

import { eventBus, fromEventBus } from "./EventBus"

export type EventTypes =
  | { type: "idle" | "zoom.in" | "zoom.out" | "pan.toggle" | "lock" | "unlock" }
  | {
      type: "mousemove" | "mousedown" | "mouseup" | "mouseleave"
      mouse: { x: number; y: number }
      button: number
    }
  | {
      type: "wheel"
      mouse: { x: number; y: number }
      deltaY: number
    }

export const MAX_ZOOM = 15
export const panZoomMachine = setup({
  actors: {
    eventBus: fromEventBus(() => eventBus),
  },
  types: {
    context: {} as {
      mouse: { x: number; y: number }
      lastMouse: { x: number; y: number }
      zoom: number
    },
    events: {} as EventTypes,
  },
  actions: {
    handlePan: (_) => {},
    handleZoom: (_) => {},
    handleAttachClickListeners: () => {},
    handleRemoveClickListeners: () => {},
    handleAttachPanListener: () => {},
    handleRemovePanListener: () => {},
    render: () => {},
  },
  guards: {
    isNotLockEvent: ({ event }) => event.type !== "lock",
    canZoom: ({ context, event }) => {
      switch (event.type) {
        case "wheel":
          return event.deltaY < 0 ? context.zoom < MAX_ZOOM : context.zoom > 1
        case "zoom.in":
          return context.zoom < MAX_ZOOM
        case "zoom.out":
          return context.zoom > 1
        default:
          return false
      }
    },
    canPan: ({ context }) => context.zoom > 1,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAcCGA7AWge2wWwEEBjAFwEtt1YBiAG2yIGsBtABgF1EVtYzzKuIAB6IArAHYANCACeiAIwBOVgDpRrDfIBM4rVsXiAbAA5DAXzPS0WXIVIUq1AK7p6TNpyQhkPPg8EiCBLScgjyAMxaKhoxysZa8vLiACzmlt4YOPjE-I4AXrYqZOgegj68uQGIWqyGKvLJxsnJrM3iisnyxsYhCloWVpm2OQ40Bfgq2E4kpV7lfgJegTWqigmmyYqGhoqKosnhvQg64dEx8obhl8ZXOgMZNtn2lLBFELRg1Naz3BX+S9VdCpwtp1CYtJd9qIjhEojENHEEklUhZ0uhsBA4GUhk9cvA5r5KgCEIojs01PCri1jKIOvdrFk7Hi3h8yoT-qBAhdRMDtJsao1RIZxJEYZEKbFWPFEik0oNHkzRiprGy-otOYgrqojEL1oZWOFFDcpLIFOL1JLpci5Q9GSMXio3IxIKqFugqmFDDyQVp+a0acLRaawop5GdNDo9AYTGkLEA */
  id: "panZoomActions",
  initial: "idle",
  context: { mouse: { x: 0, y: 0 }, lastMouse: { x: 0, y: 0 }, zoom: 1 },
  invoke: {
    id: "eventBus",
    src: "eventBus",
  },
  on: {
    lock: { target: ".locked" },
    "zoom.in": {
      guard: "canZoom",
      actions: [
        assign({
          zoom: ({ context }) =>
            Math.min(Math.max(context.zoom + 1, 1), MAX_ZOOM),
        }),
        "handleZoom",
        "render",
      ],
    },
    "zoom.out": {
      guard: "canZoom",
      actions: [
        assign({
          zoom: ({ context }) =>
            Math.min(Math.max(context.zoom - 1, 1), MAX_ZOOM),
        }),
        "handleZoom",
        "render",
      ],
    },
    wheel: {
      guard: "canZoom",
      actions: [
        assign({
          mouse: ({ event }) => event.mouse,
          zoom: ({ event, context }) =>
            Math.min(
              Math.max(context.zoom + (event.deltaY < 0 ? 1 : -1), 1),
              MAX_ZOOM
            ),
        }),
        "handleZoom",
        "render",
      ],
    },
    idle: {
      target: ".idle",
    },
  },
  states: {
    idle: {
      on: {
        "pan.toggle": {
          guard: "canPan",
          target: "pan",
        },
      },
    },
    pan: {
      initial: "idle",
      entry: [
        "handleAttachClickListeners",
        sendTo("eventBus", { type: "lock" }),
      ],
      on: {
        "pan.toggle": {
          target: "idle",
        },
      },
      exit: [
        "handleRemoveClickListeners",
        enqueueActions(({ enqueue, check }) => {
          if (check("isNotLockEvent")) {
            enqueue(sendTo("eventBus", { type: "unlock" }))
          }
        }),
      ],
      states: {
        idle: {
          on: {
            mousedown: {
              actions: [
                assign({
                  lastMouse: ({ event }) => event.mouse,
                }),
              ],
              target: "panning",
            },
          },
        },
        panning: {
          entry: ["handleAttachPanListener"],
          on: {
            mousemove: {
              actions: [
                assign({
                  mouse: ({ event }) => event.mouse,
                }),
                "handlePan",
                assign({
                  mouse: ({ event }) => event.mouse,
                  lastMouse: ({ context }) => context.mouse,
                }),
                "render",
              ],
            },
            mouseup: {
              target: "idle",
            },
            mouseleave: {
              target: "idle",
            },
          },
          exit: ["handleRemovePanListener"],
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
