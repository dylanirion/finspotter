import { type Metadata } from "next"
import { headers } from "next/headers"
import { getSession } from "lib/auth"
import { Toaster } from "react-hot-toast"

import { MyOrganization } from "./MyOrganization"
import { MySubmissions } from "./MySubmissions"
import { PipelineActivity } from "./PipelineActivity"
import { Review } from "./Review"

export const metadata: Metadata = {
  title: "Dashboard",
}

//TODO: show most recent encounter submissions with link to view all (should this include submissions pending review?)
//if admin, show all
//TODO: same for organization?
//TODO: if org admin, manage org
//TODO: pipeline pending list if allowed to review, anly admins and org admins can delete.
export default async function DashboardPage() {
  const session = await getSession({ headers: await headers() })
  const user = session!.user

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight">
        Welcome back, {user.firstName}!
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
        <MySubmissions />
        <MyOrganization />
        <PipelineActivity />
        <Review />
      </div>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
