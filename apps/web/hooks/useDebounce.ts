// https://ayubbegimkulov.com/use-debounce/
import { useLayoutEffect, useMemo, useRef } from "react"
import debounce from "lodash.debounce"
import { unstable_batchedUpdates } from "react-dom"

const useLatest = <T>(value: T) => {
  const valueRef = useRef(value)
  useLayoutEffect(() => {
    valueRef.current = value
  })
  return valueRef
}

export function useDebounce<T extends (...args: never[]) => unknown>(
  callback: T,
  wait: number
) {
  const latestCb = useLatest(callback)

  return useMemo(
    () =>
      debounce((...args: Parameters<T>) => {
        unstable_batchedUpdates(() => latestCb.current(...args))
      }, wait),
    [wait, latestCb]
  )
}
