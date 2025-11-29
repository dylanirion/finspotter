import { eventBus, fromEventBus } from "@finspotter/canvas/machines/EventBus"
import { assign, setup } from "xstate"

import { type DisplayAnnotation } from "../react/BaseAnnotationLayer"

type EventTypes =
  | {
      type: "lock" | "unlock"
    }
  | {
      type: "set.category"
      value: string
    }

export const machine = setup({
  actors: {
    eventBus: fromEventBus(() => eventBus),
  },
  types: {
    context: {} as DisplayAnnotation<"null">,
    events: {} as EventTypes,
    input: {} as DisplayAnnotation<"null">,
  },
  actions: {
    render: () => {},
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QCNkHsAeANAmgdQAkBBAYwBcBLNAO1gGIAbNEgawG0AGAXUVAAc0sCpRq8QGRACYOATgB0HRRwCMHAGwBWGQGZtGyWoA0IAJ5SALPMmWZM1QA5bGy2oC+r46ky5CpEbToKCAYwTh4kEAEhfzEJBGl5JRV1LV19I1NEZUl7ORtbZXsNfW1lZXN3T3RsfGJyKlo5IJC6AFs0AFdYSDQAd2owsSjhBtipWQUlVU0dPQNjMwQAdnttScVdbXMlzT1KkC8a33qaWCbgsDoAQ3qANyuyUO4hwRHRCLiE9eSZtPnMhCrNYaJSlezKJaqZT7Q4+Or+M43Si3S5kNBQKAhOSQYSDCLDGIfRDmSxyJZbbSODjmbRLJbqBaIcEcOQgja6ba7CoeA7VOF+BqIu6XdpdHr9PH8V6E0BxDQrOSSQqQ7JqFb2eyMhD6ZRkmyOYoycwcAwwvm1AWnORMViQOgdag29jPfHS0ZE5arOQyDTaDiOTSSbRB7Ra6xWfIOJwudw86hoCBwMSwi0nWgvaLu2WIbQyLUAWjcPJTxwR5xCGbe1DGgKWWt9LLU4ccELVanMGjN3lTZaRFBRlZl4mJKjJFKpNLpDIBzjUiv19hNGpBki7R3hgrkfZR5bAg6zw4Q5ibcgpS3MGuUBXMyi1S3033v5XUqm5VW7pc327A2IgI2oUD7u82bamouQ+qUV6SMUuY5He6h6rYdi5jIKzQWu-JpkKyI-jilAAbuQHVh6ajKHOEFlDI0G+lRmoAvYaqKmyegcLolGdsW5qflaTqQERNbOBocj2JOJL+rmi4aGGpLnrY9I+vY97QfYsauEAA */
  id: "nullActions",
  initial: "idle",
  context: ({ input }) => ({
    ...input,
  }),
  invoke: {
    id: "eventBus",
    src: "eventBus",
  },
  on: {
    lock: { target: ".locked" },
  },
  states: {
    idle: {
      id: "idle",
      always: "active",
    },
    active: {
      initial: "idle",
      on: {
        "set.category": {
          actions: assign({
            category: ({ event }) => event.value,
          }),
        },
      },
      states: {
        idle: {},
      },
    },
    locked: {
      on: {
        unlock: { target: "idle" },
      },
    },
  },
})
