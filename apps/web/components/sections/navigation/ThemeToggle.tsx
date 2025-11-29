"use client"

import { Field, Switch } from "@headlessui/react"
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid"
import { useTheme } from "contexts/Theme"

export function ThemeToggle() {
  const { theme, isSystem, setTheme } = useTheme()
  const isDark = theme === "dark"

  if (!theme) {
    return (
      <div className="flex items-center space-x-2">
        <div className="inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-slate-500" />
      </div>
    )
  }

  return (
    <Field
      // TODO: indicate which theme is system
      title={`Switch Between Light & Dark Mode`}
    >
      <div className="flex items-center space-x-2">
        <Switch
          checked={isDark}
          onChange={() =>
            setTheme(isSystem ? (isDark ? "light" : "dark") : "system")
          }
          className="group inline-flex h-6 w-11 cursor-pointer items-center rounded-full bg-gray-200 transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden dark:bg-slate-500"
        >
          <span className="inline-block size-4 translate-x-1 rounded-full transition group-data-checked:translate-x-6">
            {isDark ? (
              <MoonIcon className="fill-gray-400" />
            ) : (
              <SunIcon className="fill-gray-400" />
            )}
          </span>
        </Switch>
      </div>
    </Field>
  )
}
