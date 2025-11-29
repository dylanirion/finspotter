"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { DisclosureButton } from "@headlessui/react"
import { useQueryClient } from "@tanstack/react-query"
import { signOut } from "hooks/useSession"
import { cn } from "lib/utils"

export function UserMenuButton({
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
      className={cn(
        "block px-4 py-2 text-sm hover:bg-slate-800 hover:text-white data-active:bg-gray-100 hover:dark:bg-slate-900 data-active:dark:bg-gray-700",
        {
          "bg-gray-300 dark:bg-gray-600": currentPath === href,
        }
      )}
    >
      {label}
    </Link>
  )
}

export function MobileUserMenuButton({
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
        "bg-gray-900 text-white": currentPath === href,
        "text-gray-300 hover:bg-gray-700 hover:text-white":
          currentPath !== href,
      })}
      aria-current={currentPath === href ? "page" : undefined}
    >
      {label}
    </DisclosureButton>
  )
}

export function SignOutButton() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return (
    <Link
      as="/signout"
      href="#"
      className="block px-4 py-2 text-sm hover:bg-slate-800 hover:text-white data-active:bg-gray-100 hover:dark:bg-slate-900 data-active:dark:bg-gray-700"
      onClick={async (e) => {
        e.preventDefault()
        await signOut({
          fetchOptions: {
            onSuccess: () => {
              queryClient.resetQueries({ queryKey: ["session"] })
              router.refresh()
            },
          },
        })
      }}
    >
      Sign out
    </Link>
  )
}

export function MobileSignOutButton() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return (
    <Link
      as="/signout"
      href="#"
      className="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
      onClick={async (e) => {
        e.preventDefault()
        await signOut({
          fetchOptions: {
            onSuccess: () => {
              queryClient.resetQueries({ queryKey: ["session"] })
              router.refresh()
            },
          },
        })
      }}
    >
      Sign out
    </Link>
  )
}
