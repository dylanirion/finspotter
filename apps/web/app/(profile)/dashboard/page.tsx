import { type Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { can } from "@finspotter/core/auth/permissions"
import { getSession } from "lib/auth"
import { Toaster } from "react-hot-toast"

import { MyEncounters } from "./MyEncounters"
import { MyOrganization } from "./MyOrganization"
import { PipelineActivity } from "./PipelineActivity"
import { Review } from "./Review"

export const metadata: Metadata = {
  title: "Dashboard",
}

//TODO: link recent encounters to their detail page and add a view-all page
//TODO: same for organization?
//TODO: if org admin, manage org
//TODO: pipeline pending list if allowed to review, anly admins and org admins can delete.
export default async function DashboardPage() {
  const session = await getSession({ headers: await headers() })
  if (!session) redirect("/signin")

  const user = session?.user ?? undefined

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight">
        Welcome back, {user.firstName}!
      </h2>
      {can(user, "update", "Annotation") && (
        <Link
          className="mt-2 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
          href="/admin/identification"
        >
          Review identities awaiting identification
        </Link>
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
        <MyEncounters userId={user.id} />
        <MyOrganization />
        <PipelineActivity />
        {can(user, "review", "Annotation") && <Review />}
      </div>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
