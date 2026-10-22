import { type Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { can } from "@finspotter/core/auth/permissions"
import { getSession } from "lib/auth"
import { Toaster } from "react-hot-toast"

import { AwaitingIdentification } from "./AwaitingIdentification"

export const metadata: Metadata = {
  title: "Awaiting identification",
}

export default async function AwaitingIdentificationPage() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) redirect("/signin")
  if (!can(session.user, "update", "Annotation")) redirect("/dashboard")

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Awaiting identification
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
          Review approved annotations connected by same-animal decisions and
          assign or create their catalog identity. Unassigned observations stay
          provisional until you choose one.
        </p>
      </div>
      <AwaitingIdentification />
      <Toaster position="bottom-right" reverseOrder={false} />
    </div>
  )
}
