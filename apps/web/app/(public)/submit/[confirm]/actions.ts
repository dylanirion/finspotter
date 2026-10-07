"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@finspotter/core/auth"
import { submissionVerification } from "@finspotter/core/auth/plugin"
import { z } from "zod"

export type FormState = { error?: string; success?: string }
const submissionPath = (id: string) => `/submit/${encodeURIComponent(id)}`

export async function confirmSubmissionAction(
  submissionId: string,
  token: string,
  _state: FormState,
  _data: FormData
): Promise<FormState> {
  try {
    await auth.api.confirmSubmission({
      body: { submissionId, token },
      headers: await headers(),
    })
  } catch {
    return {
      error:
        "This link is invalid, expired, or already used. You can sign in to manage a previously confirmed submission.",
    }
  }
  redirect(submissionPath(submissionId))
}

async function getVerifiedContact(submissionId: string) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  })
  if (!session?.user.emailVerified)
    throw new Error("Sign in to manage this submission")
  const contacts = await submissionVerification().listContacts(
    submissionId,
    session.user.id
  )
  if (!contacts.length)
    throw new Error("Confirm your email for this submission first")
  return { session, contacts, requestHeaders }
}

export async function saveSubmissionPreferences(
  submissionId: string,
  _state: FormState,
  data: FormData
): Promise<FormState> {
  try {
    const { contacts } = await getVerifiedContact(submissionId)
    for (const contact of contacts)
      await submissionVerification().setUpdates(
        contact,
        data.get("updates") === "on"
      )
    revalidatePath(submissionPath(submissionId))
    return { success: "Notification preferences saved." }
  } catch {
    return {
      error: "Unable to save preferences. Please sign in and try again.",
    }
  }
}

export async function createSubmissionAccount(
  submissionId: string,
  _state: FormState,
  data: FormData
): Promise<FormState> {
  const password = z.string().min(1).safeParse(data.get("password"))
  if (!password.success || password.data !== data.get("confirmPassword"))
    return { error: "Passwords must match." }
  try {
    const { session, requestHeaders } = await getVerifiedContact(submissionId)
    const context = await auth.$context
    if (
      password.data.length < context.password.config.minPasswordLength ||
      password.data.length > context.password.config.maxPasswordLength
    )
      return {
        error: `Use between ${context.password.config.minPasswordLength} and ${context.password.config.maxPasswordLength} characters.`,
      }
    const firstName = z
      .string()
      .trim()
      .max(100)
      .parse(data.get("firstName") ?? "")
    const lastName = z
      .string()
      .trim()
      .max(100)
      .parse(data.get("lastName") ?? "")
    await auth.api.setPassword({
      body: { newPassword: password.data },
      headers: requestHeaders,
    })
    await context.internalAdapter.updateUser(session.user.id, {
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(" "),
    })
    revalidatePath(submissionPath(submissionId))
    return {
      success:
        "Your account is ready. You can now sign in with your email and password.",
    }
  } catch {
    return {
      error:
        "Unable to create an account. Your session may have expired, or a password is already set. Sign in or request a password reset.",
    }
  }
}
