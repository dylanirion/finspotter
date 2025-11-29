"use client"

import { type PropsWithChildren } from "react"
import { ReCaptchaProvider } from "next-recaptcha-v3"

export function CaptchaProvider({ children }: PropsWithChildren<object>) {
  return (
    <ReCaptchaProvider
      reCaptchaKey={process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY}
      useEnterprise={true}
    >
      {children}
    </ReCaptchaProvider>
  )
}
