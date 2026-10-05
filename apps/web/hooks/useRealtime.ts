import { useCallback, useEffect, useRef } from "react"
import { Amplify } from "aws-amplify"
import { events, type EventsChannel, type EventsOptions } from "aws-amplify/api"

const endpoint = process.env.NEXT_PUBLIC_REALTIME_ENDPOINT
const region = process.env.NEXT_PUBLIC_REALTIME_REGION
const identityPoolId = process.env.NEXT_PUBLIC_IDENTITY_POOL

if (!endpoint || !region || !identityPoolId) {
  throw new Error("Realtime client configuration is incomplete")
}

Amplify.configure({
  API: {
    Events: {
      endpoint,
      region,
      defaultAuthMode: "identityPool",
    },
  },
  Auth: {
    Cognito: {
      identityPoolId,
      allowGuestAccess: true,
    },
  },
})

type Channel = Awaited<ReturnType<typeof events.connect>>
type SubscriptionObserver = Parameters<Channel["subscribe"]>[0]
type DocumentType = Parameters<Channel["publish"]>[0]

export function useRealtime() {
  const channelRef = useRef<EventsChannel>(null)
  const channelNameRef = useRef<string | null>(null)

  const connect = useCallback(async (channelName: string) => {
    console.debug(`Connecting to channel ${channelName}`)
    const channel = await events.connect(channelName)
    channelRef.current = channel
    channelNameRef.current = channelName
    return channel
  }, [])

  const subscribe = useCallback(
    (observer: SubscriptionObserver, subOptions?: EventsOptions) => {
      if (!channelRef.current) {
        throw new Error("Cannot subscribe: channel not connected")
      }
      return channelRef.current.subscribe(observer, subOptions)
    },
    []
  )

  const publish = useCallback(
    (event: DocumentType, pubOptions?: EventsOptions) => {
      if (!channelRef.current) {
        throw new Error("Cannot publish: channel not connected")
      }
      return channelRef.current.publish(event, pubOptions)
    },
    []
  )

  const close = useCallback(() => {
    if (channelRef.current) {
      console.debug(`Closing channel ${channelNameRef.current}`)
      channelRef.current.close()
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      close()
    }
  }, [close])

  return { connect, subscribe, publish, close }
}
