import { Fragment, type HTMLProps } from "react"
import { headers } from "next/headers"
import Link from "next/link"
import { userMenuItems } from "@finspotter/config/site"
import {
  DisclosureButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react"
import { ProfilePicture } from "components/ui/images/ProfilePicture"
import { getSession } from "lib/auth"

import { NotificationMenu } from "./NotificationMenu"
import {
  MobileSignOutButton,
  MobileUserMenuButton,
  SignOutButton,
  UserMenuButton,
} from "./UserMenuButton"

export function SignInButton({ className, ref }: HTMLProps<HTMLAnchorElement>) {
  return (
    <Link ref={ref} className={className} href="/signin">
      Sign In
    </Link>
  )
}

export async function UserMenu() {
  const session = await getSession({ headers: await headers() })

  if (!session) {
    return (
      <SignInButton className="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white" />
    )
  }

  if (session) {
    return (
      <>
        <NotificationMenu />
        <Menu as="div" className="relative">
          <MenuButton className="cursor-pointer rounded-full p-1 text-gray-300 hover:text-white data-open:text-white">
            <span className="sr-only">Open user menu</span>
            <ProfilePicture
              className="size-8 rounded-full"
              src={session.user?.image ?? undefined}
              alt="Profile picture"
              width={50}
              height={50}
            />
          </MenuButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <MenuItems
              className="z-40 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:8px] focus:outline-hidden dark:bg-slate-700"
              anchor="bottom end"
            >
              <MenuItem>
                <UserMenuButton label="Dashboard" href="/dashboard" />
              </MenuItem>
              {userMenuItems.map(({ label, href }) => (
                <MenuItem key={label}>
                  <UserMenuButton label={label} href={href} />
                </MenuItem>
              ))}
              <MenuItem>
                <SignOutButton />
              </MenuItem>
            </MenuItems>
          </Transition>
        </Menu>
      </>
    )
  }
  return null
}

export async function MobileUserMenu() {
  const session = await getSession({ headers: await headers() })

  if (!session) {
    return (
      <DisclosureButton as="div">
        <SignInButton className="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white" />
      </DisclosureButton>
    )
  }

  if (session) {
    return (
      <div className="divide-y divide-gray-400">
        {/* TODO: Notification Menu?? */}
        <div>{/* <NotificationMenu /> */}</div>
        <div>
          <MobileUserMenuButton label="Dashboard" href="/admin" />
          {userMenuItems.map(({ label, href }) => (
            <MobileUserMenuButton key={label} label={label} href={href} />
          ))}
          <DisclosureButton as="div">
            <MobileSignOutButton />
          </DisclosureButton>
        </div>
      </div>
    )
  }
  return null
}
