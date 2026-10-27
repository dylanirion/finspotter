import { Suspense } from "react"
import { type Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { can } from "@finspotter/core/auth/permissions"
import { getSession } from "lib/auth"
import { Toaster } from "react-hot-toast"

import { ReviewTable } from "./ReviewTable"

export const metadata: Metadata = {
  title: "Review queue",
}

export default async function ReviewQueuePage() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) redirect("/signin")
  if (!can(session.user, "review", "Annotation")) redirect("/dashboard")

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
      >
        Back to dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review queue</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
          Highest-scoring results first by default. Select a column heading to
          change the order. Unscored results are marked for triage.
        </p>
      </div>
      <Suspense fallback={<p>Loading review queue...</p>}>
        <ReviewTable />
      </Suspense>
      <Toaster position="bottom-right" reverseOrder={false} />
    </div>
  )
}
