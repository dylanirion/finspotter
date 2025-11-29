"use client"

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react"
import { useIsomorphicLayoutEffect } from "hooks/useIsomorphicLayoutEffect"
//import Script from "next/script"
import { useStorage } from "hooks/useStorage"

const LOCALSTORAGEKEY = "FinSpotter::Theme"
const MEDIAQUERY = "(prefers-color-scheme: dark)"
const themes = ["light", "dark"]
type Themes = (typeof themes)[number] | "system"

export function useTheme() {
  const context = useContext(ThemeContext)

  if (context === undefined) {
    throw new Error("useTheme must be used inside the ThemeProvider")
  }

  return context
}

const ThemeContext = createContext<
  | {
      theme: string | undefined
      isSystem: boolean
      setTheme: (theme: Themes) => void
    }
  | undefined
>(undefined)

export const ThemeProvider = ({
  children,
}: PropsWithChildren<object>): ReactNode => {
  const { getItem, setItem } = useStorage("local")
  const [internalTheme, setInternalTheme] = useState<Themes>(
    () => getItem<Themes>(LOCALSTORAGEKEY) ?? "system"
  )
  const [resolvedTheme, setResolvedTheme] =
    useState<Omit<Themes, "system">>(internalTheme)

  const applyTheme = useCallback((theme: Omit<Themes, "system">) => {
    const d = document.documentElement
    if (theme === "dark" && !d.classList.contains(theme as string)) {
      console.debug("Applying dark theme")
      d.classList.add("dark")
      d.style.colorScheme = theme as string
    } else if (theme === "light") {
      console.debug("Applying light theme")
      d.classList.remove("dark")
      d.style.colorScheme = theme as string
    }
    setResolvedTheme(theme)
  }, [])

  const setTheme = useCallback(
    (theme: Themes) => {
      setInternalTheme(theme)
      setItem(LOCALSTORAGEKEY, theme)
    },
    [setItem]
  )

  // Listen to changes in system theme
  useIsomorphicLayoutEffect(() => {
    const mediaQuery = window.matchMedia(MEDIAQUERY)

    const handleSystemThemeChange = () => {
      if (internalTheme === "system") {
        const theme = resolveSystemTheme(mediaQuery)
        setTheme(theme)
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)

    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange)
  }, [])

  // Listen to changes in local storage theme
  useIsomorphicLayoutEffect(() => {
    const controller = new AbortController()
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== LOCALSTORAGEKEY) {
        return
      }
      setTheme(JSON.parse(e.newValue ?? '"system"') as Themes)
    }

    window.addEventListener("storage", handleStorageChange, {
      signal: controller.signal,
    })

    return () => controller.abort()
  }, [])

  useIsomorphicLayoutEffect(() => {
    const mediaQuery = window.matchMedia(MEDIAQUERY)
    applyTheme(
      internalTheme === "system"
        ? resolveSystemTheme(mediaQuery)
        : internalTheme
    )
  }, [internalTheme])

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme as string,
        isSystem: internalTheme === "system",
        setTheme,
      }}
    >
      {/* TODO: is this OK in body? */}
      <ThemeScript
        localStorageKey={LOCALSTORAGEKEY}
        themes={themes}
        query={MEDIAQUERY}
      />
      {children}
    </ThemeContext.Provider>
  )
}

function resolveSystemTheme(e: MediaQueryList) {
  return e.matches ? "dark" : "light"
}

const ThemeScript = memo(
  ({
    localStorageKey,
    themes,
    query,
  }: {
    localStorageKey: string
    themes: Array<Omit<Themes, "system">>
    query: string
  }) => {
    const clientScript = (
      localStorageKey: string,
      themes: Array<Omit<Themes, "system">>,
      query: string
    ) => {
      const internalTheme: Themes = JSON.parse(
        window.localStorage.getItem(localStorageKey) || '"system"'
      )
      const theme: Omit<Themes, "system"> =
        internalTheme === "system"
          ? window.matchMedia(query).matches
            ? "dark"
            : "light"
          : internalTheme
      console.debug(`Applying ${theme} theme`)
      const d = document.documentElement
      d.classList.remove(...(themes as Array<string>))
      d.classList.add(theme as string)
      d.style.colorScheme = theme as string
    }

    const args = JSON.stringify([localStorageKey, themes, query]).slice(1, -1)

    return (
      /*
      <Script id="setTheme" strategy="beforeInteractive">
        {`(${clientScript.toString()})(${args})`}
      </Script>
      */
      <script
        dangerouslySetInnerHTML={{
          __html: `(${clientScript.toString()})(${args})`,
        }}
        suppressHydrationWarning
      />
    )
  }
)
ThemeScript.displayName = "ThemeScript"
