import { useCallback, useMemo } from "react"

type StorageType = "session" | "local"

/** Represents the actions available to interact with the Storage API.*/
interface UseStorageReturn {
  /**
   * A function to get a value from storage.
   * Values are serialized with `JSON.stringify`
   * @template T - The type of value in the storage.
   */
  getItem: <T>(key: string) => T | undefined
  /**
   * A function to set a value in storage.
   * Values are unserialized with `JSON.parse`
   */
  setItem: (key: string, value: unknown) => void
  /** A function to remove a value from storage. */
  removeItem: (key: string) => void
  /** A function to clear all values from storage. */
  clear: () => void
}

/**
 * Custom hook that uses the [`sessionStorage API`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
 * or [`localStorage API`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) to persist data across page reloads.
 * Values are serialized with `JSON.stringify` and unserialized with `JSON.parse`
 * @example
 * ```tsx
 * const { getItem, setItem, removeItem, clear } = useStorage("local")
 * setItem("item-key", "item value")
 * const item = getItem<string>("item-key")
 * ```
 */
export function useStorage(type: StorageType = "local"): UseStorageReturn {
  const storageType: "localStorage" | "sessionStorage" = `${type}Storage`

  const isBrowser = useMemo(() => typeof window !== "undefined", [])

  const getItem = useCallback(
    <T>(key: string): T | undefined => {
      return isBrowser
        ? window[storageType][key] && window[storageType][key] !== "undefined"
          ? JSON.parse(window[storageType][key])
          : undefined
        : undefined
    },
    [isBrowser, storageType]
  )

  const setItem = useCallback(
    (key: string, value: unknown) => {
      console.debug(`Setting ${storageType} [${key}]`, value)
      if (isBrowser) {
        window[storageType].setItem(key, JSON.stringify(value))
      }
    },
    [isBrowser, storageType]
  )

  const removeItem = useCallback(
    (key: string) => {
      if (isBrowser) {
        window[storageType].removeItem(key)
      }
    },
    [isBrowser, storageType]
  )

  const clear = useCallback(() => {
    if (isBrowser) {
      window[storageType].clear()
    }
  }, [storageType, isBrowser])

  return {
    getItem,
    setItem,
    removeItem,
    clear,
  }
}
