import { type Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@finspotter/core/auth"
import { submissionVerification } from "@finspotter/core/auth/plugin"

import { AccountForm, ConfirmationForm, PreferencesForm } from "./Forms"

export const metadata: Metadata = {
  title: "Confirm Submission",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function ConfirmSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ confirm: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { confirm } = await params
  const { token } = await searchParams
  if (token) {
    let role: "submitter" | "subscriber"
    try {
      role = (await submissionVerification().inspect(confirm, token)).role
    } catch {
      return (
        <section className="space-y-4">
          <h1>Verification link unavailable</h1>
          <p>This link is invalid, expired, or already used.</p>
          <Link
            href={`/signin?from=${encodeURIComponent(`/submit/${confirm}`)}`}
          >
            Sign in
          </Link>
        </section>
      )
    }
    return (
      <section className="space-y-4">
        <h1>
          {role === "submitter"
            ? "Confirm your submission"
            : "Confirm your subscription"}
        </h1>
        <ConfirmationForm submissionId={confirm} token={token} />
      </section>
    )
  }
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  const contacts = session?.user.emailVerified
    ? await submissionVerification().listContacts(confirm, session.user.id)
    : []
  if (!session || !contacts.length) {
    return (
      <section className="space-y-4">
        <h1>Submission confirmation</h1>
        <p>
          Open the confirmation link in your email, or sign in to manage a
          confirmed submission.
        </p>
        <Link href={`/signin?from=${encodeURIComponent(`/submit/${confirm}`)}`}>
          Sign in
        </Link>
      </section>
    )
  }
  const context = await auth.$context
  const account = await context.internalAdapter.findCredentialAccount(
    session.user.id
  )
  const submitted = contacts.some((contact) => contact.role === "submitter")
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1>{submitted ? "Submission verified" : "Subscription verified"}</h1>
        <PreferencesForm
          submissionId={confirm}
          enabled={contacts.every((contact) => contact.updates_enabled)}
        />
      </section>
      {!account?.password && (
        <section className="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h2>Create an account (optional)</h2>
          <AccountForm
            submissionId={confirm}
            firstName={session.user.firstName ?? ""}
            lastName={session.user.lastName ?? ""}
            minLength={context.password.config.minPasswordLength}
            maxLength={context.password.config.maxPasswordLength}
          />
        </section>
      )}
      <Link href="/">Not now</Link>
    </div>
  )
}
