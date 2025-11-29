import { type Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { CaptchaProvider } from "contexts/Captcha"
import { getSession } from "lib/auth"

import { SignInForm } from "./SignInForm"

export const metadata: Metadata = {
  title: "Sign in to your account",
}

export default async function SignInPage() {
  const session = await getSession({ headers: await headers() })

  if (session?.user) {
    redirect("/profile")
  }

  return (
    <CaptchaProvider>
      <SignInForm />
    </CaptchaProvider>
  )
}
