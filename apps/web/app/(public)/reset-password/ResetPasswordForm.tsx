"use client"

import { useCallback, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { LockClosedIcon } from "@heroicons/react/20/solid"
import { ExclamationCircleIcon } from "@heroicons/react/24/solid"
import { Button } from "components/ui/inputs/Button"
import { Spinner } from "components/ui/spinners/Spinner"
import { resetPassword } from "hooks/useSession"
import { cn } from "lib/utils"
import { useFormStatus } from "react-dom"
import toast, { Toaster } from "react-hot-toast"

//TODO: form clears on submit, maybe hide the form instead?
//TODO: this should be a small popup window that instead of redirecting, says it is safe to close
export function ResetPasswordForm({ token }: { token: string }) {
  const [form, setForm] = useState<{
    password?: string
    confirmPassword?: string
  }>({
    password: undefined,
    confirmPassword: undefined,
  })
  const validPasswordLength = !!form.password && form.password.length > 8
  const isValidPassword = validPasswordLength
  const doPasswordsMatch =
    !!form.password &&
    !!form.confirmPassword &&
    form.password === form.confirmPassword
  const router = useRouter()

  const handleChangeField = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }, [])

  const handleChangePassword = useCallback(
    async (formData: FormData) => {
      if (!token) return
      return resetPassword({
        newPassword: formData.get("password") as string,
        token,
        fetchOptions: {
          onError(ctx) {
            throw new Error(ctx.error.message)
          },
        },
      })
        .then(() => {
          toast.success(
            `Password successfully changed, you will be redirected to the sign in form shortly.`
          )
          setTimeout(() => {
            router.replace("/signin")
          }, 3000)
        })
        .catch(() => {
          toast.error("Error changing password.")
        })
    },
    [router, token]
  )

  return (
    <>
      <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col space-y-8 object-center">
            <Toaster
              containerStyle={{
                inset: "16px 0px",
                position: "relative",
              }}
            />
            <div>
              <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
                Change your password
              </h2>
            </div>
            <form className="mt-8 space-y-6" action={handleChangePassword}>
              <div className="relative">
                <label htmlFor="new-password" className="sr-only">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className={cn(
                    "relative block w-full rounded-md border border-gray-300 px-3 py-2 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-slate-500 dark:bg-slate-700",
                    {
                      "border-red-500 focus:border-red-500 focus:ring-red-500":
                        !!form.password && !validPasswordLength,
                    }
                  )}
                  placeholder="New Password"
                  autoComplete="new-password"
                  onChange={handleChangeField}
                />
                {!!form.password && !validPasswordLength && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <ExclamationCircleIcon
                      title="Password must be at least 8 characters!"
                      className="size-6 fill-red-500 stroke-white"
                    />
                  </div>
                )}
              </div>
              <div className="relative">
                <label htmlFor="re-enter-password" className="sr-only">
                  Re-enter New Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className={cn(
                    "relative block w-full rounded-md border border-gray-300 px-3 py-2 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-slate-500 dark:bg-slate-700",
                    {
                      "border-red-500 focus:border-red-500 focus:ring-red-500":
                        !!form.confirmPassword && !doPasswordsMatch,
                      "cursor-not-allowed bg-gray-100 text-gray-500":
                        !isValidPassword,
                    }
                  )}
                  disabled={!isValidPassword}
                  placeholder="Re-enter New Password"
                  autoComplete="new-password"
                  onChange={handleChangeField}
                />
                {!!form.confirmPassword && !doPasswordsMatch && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <ExclamationCircleIcon
                      title="Passwords do not match!"
                      className="size-6 fill-red-500 stroke-white"
                    />
                  </div>
                )}
              </div>
              <SubmitButton
                canSubmit={
                  !!form.password &&
                  !!form.confirmPassword &&
                  isValidPassword &&
                  doPasswordsMatch
                }
              />
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

function SubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending: isPending } = useFormStatus()

  return (
    <Button
      type="submit"
      intent="none"
      size="medium"
      className="group relative flex cursor-pointer justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:hover:bg-indigo-300 data-pending:cursor-wait"
      fullWidth={true}
      disabled={!canSubmit || isPending}
    >
      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
        {isPending ? (
          <Spinner className="hidden size-5 animate-spin text-indigo-400" />
        ) : (
          <LockClosedIcon
            className="hidden h-5 w-5 text-indigo-500 group-hover:text-indigo-400 group-disabled:block group-disabled:text-indigo-200 group-disabled:group-hover:text-indigo-200"
            aria-hidden="true"
          />
        )}
      </span>
      {isPending ? "Changing Password" : "Change Password"}
    </Button>
  )
}
