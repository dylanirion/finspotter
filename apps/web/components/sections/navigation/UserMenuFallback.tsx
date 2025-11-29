import { headers } from "next/headers"
import { BellIcon } from "@heroicons/react/24/outline"
import { ProfilePicture } from "components/ui/images/ProfilePicture"
import { Button } from "components/ui/inputs/Button"

import { SignInButton } from "./UserMenu"

function checkOptimisticSession(headers: Headers) {
  const guessIsSignIn =
    headers.get("cookie")?.includes("better-auth.session") ||
    headers.get("cookie")?.includes("__Secure-better-auth.session-token")
  return !!guessIsSignIn
}

export async function UserMenuFallback() {
  const signedInGuess = checkOptimisticSession(await headers())

  if (!signedInGuess)
    return (
      <SignInButton className="block rounded-md px-3 py-2 text-base font-medium" />
    )

  return (
    <>
      <div className="relative">
        <Button
          className="relative cursor-pointer rounded-full p-1 text-gray-300 hover:text-white focus:outline-hidden data-open:text-white"
          intent="none"
          size="none"
        >
          <span className="sr-only">View notifications</span>
          <BellIcon className="size-8" aria-hidden="true" />
        </Button>
      </div>
      <div className="relative">
        <Button
          className="cursor-pointer rounded-full p-1 text-gray-300 hover:text-white data-open:text-white"
          intent="none"
          size="none"
        >
          <span className="sr-only">Open user menu</span>
          <ProfilePicture
            className="size-8 rounded-full"
            src={undefined}
            alt="Profile picture"
            width={50}
            height={50}
          />
        </Button>
      </div>
    </>
  )
}
