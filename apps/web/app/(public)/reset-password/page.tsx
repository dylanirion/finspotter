import React from "react"
import { type Metadata } from "next"
import { redirect } from "next/navigation"

import { ResetPasswordForm } from "./ResetPasswordForm"

export const metadata: Metadata = {
  title: "Reset Password",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token: string }>
}) {
  const { token } = await searchParams

  if (!token) redirect("/")
  return <ResetPasswordForm token={token} />
}
