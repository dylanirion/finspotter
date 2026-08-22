"use client"

import { useCallback } from "react"
import { useReCaptcha } from "next-recaptcha-v3"
import toast from "react-hot-toast"

type CaptchaAction<TArgs extends unknown[], TResult> = (
  token: string,
  ...args: TArgs
) => Promise<TResult>

export function useCaptchaAction<TArgs extends unknown[], TResult>(
  action: string,
  fn: CaptchaAction<TArgs, TResult>
) {
  const { executeRecaptcha } = useReCaptcha()

  return useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      let token = ""
      if (executeRecaptcha) {
        try {
          token = (await executeRecaptcha(action)) ?? ""
        } catch (err) {
          console.error(err instanceof Error ? err.message : "reCAPTCHA is unavailable")
          toast.error("Something went wrong, please try again.")
          return
        }
      }
      return fn(token, ...args)
    },
    [executeRecaptcha, action, fn]
  )
}
