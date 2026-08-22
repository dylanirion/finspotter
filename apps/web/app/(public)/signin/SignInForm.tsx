"use client"

import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
//import { faFacebook, faGoogle } from "@fortawesome/free-brands-svg-icons"
//import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { LockClosedIcon } from "@heroicons/react/20/solid"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "components/ui/inputs/Button"
import { Spinner } from "components/ui/spinners/Spinner"
import { useCaptchaAction } from "hooks/useCaptchaAction"
import { forgetPassword, signIn } from "hooks/useSession"
import { cn } from "lib/utils"
import toast, { Toaster } from "react-hot-toast"

//TODO: useActionState with signIn? even thought It's not a server action?
export function SignInForm() {
  const emailRef = useRef<HTMLInputElement | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const rememberRef = useRef<HTMLInputElement | null>(null)
  const [isMouseSpinning, setMouseSpinning] = useState(false)
  const [isButtonSpinning, setButtonSpinning] = useState(false)
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const stopSpinning = useCallback(() => {
    setMouseSpinning(false)
    setButtonSpinning(false)
  }, [])

  const submitSignIn = useCaptchaAction(
    "login",
    useCallback(
      (token: string, email: string, password: string, rememberMe: boolean) =>
        signIn.email({
          email,
          password,
          callbackURL: searchParams?.get("from") ?? "/dashboard",
          rememberMe,
          fetchOptions: {
            headers: { "x-captcha-token": token },
            onError(ctx) {
              stopSpinning()
              toast.error(ctx.error.message ?? "Unable to sign in", {
                id: ctx.error.code ?? "default",
              })
            },
            onSuccess() {
              setMouseSpinning(false)
              queryClient.resetQueries({ queryKey: ["session"] })
            },
          },
        }),
      [searchParams, queryClient, stopSpinning]
    )
  )

  const submitForgot = useCaptchaAction(
    "password_reset",
    useCallback(
      (token: string, email: string) =>
        forgetPassword({
          email,
          redirectTo: "/reset-password",
          fetchOptions: { headers: { "x-captcha-token": token } },
        }),
      []
    )
  )

  const handleCredentials = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const email = emailRef.current?.value
      const password = passwordRef.current?.value
      if (!email || !password) {
        toast.error("Please provide an email address and password.")
        return
      }
      setMouseSpinning(true)
      setButtonSpinning(true)
      const result = await submitSignIn(
        email,
        password,
        rememberRef.current?.checked ?? false
      )
      if (result === undefined) stopSpinning() // captcha failed before the request
    },
    [submitSignIn, stopSpinning]
  )

  //TODO: this should disable sign in button too
  const handleForgot = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault()
      const email = emailRef.current?.value
      if (!email) {
        toast.error("Please provide an email address.")
        return
      }
      setMouseSpinning(true)
      setButtonSpinning(true)
      try {
        const result = await submitForgot(email)
        if (result !== undefined) {
          toast.success(`A change password request was sent to ${email}`)
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Unable to send reset email"
        )
      } finally {
        stopSpinning()
      }
    },
    [submitForgot, stopSpinning]
  )

  return (
    <>
      <div
        className={cn("flex items-center justify-center px-4 sm:px-6 lg:px-8", {
          "cursor-wait": isMouseSpinning,
        })}
      >
        <div
          className={cn("w-full max-w-md", {
            "pointer-events-none": isMouseSpinning,
          })}
        >
          <div className="flex flex-col space-y-8 object-center">
            <Toaster
              containerStyle={{
                inset: "16px 0px",
                position: "relative",
              }}
            />
            <div>
              <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
                Sign in to your account
              </h2>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleCredentials}>
              <div className="-space-y-px rounded-md shadow-sm md:space-y-3">
                <div>
                  <label htmlFor="email-address" className="sr-only">
                    Email address
                  </label>
                  <input
                    ref={emailRef}
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm md:rounded-md dark:border-slate-500 dark:bg-slate-700"
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm md:rounded-md dark:border-slate-500 dark:bg-slate-700"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    ref={rememberRef}
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700"
                  />
                  <label htmlFor="remember-me" className="ml-2 block">
                    Remember me
                  </label>
                </div>
                <div className="text-sm">
                  <a
                    //TODO: make this a button?
                    href="#"
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                    onClick={(e) => handleForgot(e)}
                  >
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  className="group relative flex cursor-pointer justify-center disabled:bg-gray-500 disabled:text-white disabled:hover:bg-gray-500"
                  intent="primary"
                  size="medium"
                  fullWidth={true}
                  disabled={isButtonSpinning}
                >
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    {isButtonSpinning ? (
                      <Spinner className="size-5 animate-spin text-indigo-400" />
                    ) : (
                      <LockClosedIcon
                        className="size-5 text-indigo-500 group-hover:text-indigo-400"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  Sign in
                </Button>
              </div>
            </form>
            {/*             <div className="relative flex items-center">
              <div className="grow border-t border-gray-400"></div>
              <span className="mx-4 shrink text-gray-400">
                Or continue with
              </span>
              <div className="grow border-t border-gray-400"></div>
            </div>
            <div className="flex space-x-4">
              <Button
                intent="secondary"
                size="medium"
                fullWidth={true}
                className={cn("group relative flex justify-center", {
                  "cursor-wait": isMouseSpinning,
                })}
                onClick={() => signIn("facebook")}
              >
                <FontAwesomeIcon
                  className="size-5 text-indigo-300 group-hover:text-indigo-200"
                  icon={faFacebook}
                />
              </Button>
              <Button
                intent="secondary"
                size="medium"
                fullWidth={true}
                className={cn("group relative flex justify-center", {
                  "cursor-wait": isMouseSpinning,
                })}
                onClick={() => signIn("google")}
              >
                <FontAwesomeIcon
                  className="size-5 text-indigo-300 group-hover:text-indigo-200"
                  icon={faGoogle}
                />
              </Button>
            </div> */}
            <div className="pt-14 text-center text-sm text-slate-400 sm:pt-6">
              This site is protected by reCAPTCHA, the Google{" "}
              <Link
                className="text-indigo-600"
                href="https://policies.google.com/privacy"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                className="text-indigo-600"
                href="https://policies.google.com/terms"
              >
                Terms of Service
              </Link>{" "}
              apply.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
