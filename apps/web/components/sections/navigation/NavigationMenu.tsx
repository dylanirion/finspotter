import { Suspense } from "react"
import Link from "next/link"
import { mainMenuItems } from "@finspotter/config/site"
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react"
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline"
import {
  MobileUserMenu,
  UserMenu,
} from "components/sections/navigation/UserMenu"
import { SiteLogo } from "components/ui/logos/SiteLogo"
import { cn } from "lib/utils"

import { MobileNavigationButton, NavigationButton } from "./NavigationButton"
import { Search } from "./Search"
import { ThemeToggle } from "./ThemeToggle"
import { UserMenuFallback } from "./UserMenuFallback"

export function NavigationMenu() {
  return (
    <header>
      <Disclosure
        as="nav"
        className="fixed top-0 left-0 z-40 w-full bg-slate-800 dark:bg-slate-900"
      >
        <>
          <div className="mx-auto px-2 sm:px-6 lg:px-8">
            <div className="flex h-16 grow-0 items-center justify-between">
              <div className="flex items-center sm:hidden">
                {/* Mobile menu button*/}
                <DisclosureButton
                  id="mobile"
                  className={cn(
                    "group inline-flex items-center justify-center rounded-md p-2 text-gray-300 hover:bg-gray-700 hover:text-white focus:ring-2 focus:ring-white focus:outline-hidden focus:ring-inset"
                  )}
                >
                  <span className="sr-only">Open main menu</span>
                  <XMarkIcon
                    className="hidden size-6 group-data-open:block"
                    aria-hidden="true"
                  />
                  <Bars3Icon
                    className="block size-6 group-data-open:hidden"
                    aria-hidden="true"
                  />
                </DisclosureButton>
              </div>
              <div className="flex flex-1 items-center justify-end sm:justify-start">
                <div className="relative flex shrink-0 items-center">
                  <Link href="/">
                    <SiteLogo className="block h-12 w-auto lg:hidden" />
                    <SiteLogo className="hidden h-12 w-auto lg:block" />
                  </Link>
                </div>
                <div className="hidden sm:ml-6 sm:block">
                  <div className="flex space-x-4">
                    {mainMenuItems.map(({ label, href }) => (
                      <NavigationButton key={href} label={label} href={href} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-end pr-2 sm:pr-0">
                <Search />
                <ThemeToggle />
                <div className="hidden sm:flex">
                  <div className="flex w-24 items-center justify-around">
                    <Suspense fallback={<UserMenuFallback />}>
                      <UserMenu />
                    </Suspense>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Mobile menu panel*/}
          <DisclosurePanel className="z-40 sm:hidden">
            <div className="space-y-1 px-2 pt-2 pb-3">
              {mainMenuItems.map(({ label, href }) => (
                <MobileNavigationButton key={label} label={label} href={href} />
              ))}
              <Suspense>
                <MobileUserMenu />
              </Suspense>
            </div>
          </DisclosurePanel>
        </>
      </Disclosure>
    </header>
  )
}
