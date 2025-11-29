//https://github.com/ChrisShank/xstate-behaviors/blob/master/src/event-bus/from-event-bus.ts
//https://github.com/statelyai/xstate/discussions/3345#discussioncomment-2892117

import {
  fromCallback,
  type AnyEventObject,
  type EventObject,
  type Subscription,
} from "xstate"

type Listener<TEvent extends EventObject = AnyEventObject> = (
  event: TEvent
) => void

export class EventBus<TEvent extends EventObject = AnyEventObject> {
  state: "running" | "stopped" = "running"
  listeners: Set<Listener<TEvent>> = new Set()

  constructor(readonly id: string) {}

  protected get isStopped() {
    return this.state === "stopped"
  }

  subscribe(listener: Listener<TEvent>): Subscription {
    if (this.isStopped) return { unsubscribe: () => {} }

    this.listeners.add(listener)

    return {
      unsubscribe: () => this.listeners.delete(listener),
    }
  }

  send(event: TEvent, listenerToIgnore?: Listener<TEvent>) {
    if (this.isStopped) return

    for (const listener of this.listeners) {
      if (listener !== listenerToIgnore) listener(event)
    }
  }

  stop() {
    if (this.isStopped) return

    this.state = "stopped"
    this.listeners.clear()
  }
}

export function fromEventBus<TEvent extends EventObject = AnyEventObject>(
  eventBusCreator: () => EventBus<TEvent>
) {
  return fromCallback(({ sendBack, receive }) => {
    const bus = eventBusCreator()

    const listener: Listener<TEvent> = (event) => {
      sendBack(event)
    }

    const subscription = bus.subscribe(listener)

    receive((event) => {
      bus.send(event as TEvent, listener)
    })

    return subscription.unsubscribe
  })
}

export const eventBus = new EventBus("Bus")
