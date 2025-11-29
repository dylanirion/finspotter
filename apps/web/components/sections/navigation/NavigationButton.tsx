"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { DisclosureButton } from "@headlessui/react"
import { cn } from "lib/utils"

export function NavigationButton({
  label,
  href,
}: {
  label: string
  href: string
}) {
  const currentPath = usePathname()
  return (
    <Link
      href={href}
      className={cn("rounded-md px-3 py-2 text-base font-medium", {
        "bg-gray-900 text-white dark:bg-gray-600": currentPath === href,
        "text-gray-300 hover:bg-gray-700 hover:text-white":
          currentPath !== href,
      })}
      aria-current={currentPath === href ? "page" : undefined}
    >
      {label}
    </Link>
  )
}

export function MobileNavigationButton({
  label,
  href,
}: {
  label: string
  href: string
}) {
  const currentPath = usePathname()
  return (
    <DisclosureButton
      id={label}
      as={Link}
      href={href}
      className={cn("block rounded-md px-3 py-2 text-base font-medium", {
        "bg-gray-900 text-white dark:bg-gray-600": currentPath === href,
        "text-gray-300 hover:bg-gray-700 hover:text-white":
          currentPath !== href,
      })}
      aria-current={currentPath === href ? "page" : undefined}
    >
      {label}
    </DisclosureButton>
  )
}
