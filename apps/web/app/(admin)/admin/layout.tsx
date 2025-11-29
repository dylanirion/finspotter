import { type PropsWithChildren } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSession } from "lib/auth"

//import { AdminSidebar } from "app/(admin)/admin/AdminSidebar"

export default async function AdminLayout({
  children,
}: PropsWithChildren<object>) {
  const session = await getSession({ headers: await headers() })
  if (!session) redirect("/signin")

  return (
    <div>
      {/* <AdminSidebar /> */}
      <main>
        <div className="absolute top-20 left-60 mr-12 w-full max-w-xs sm:max-w-md md:max-w-4xl lg:max-w-6xl">
          <div className="container">{children}</div>
        </div>
      </main>
    </div>
  )
}
