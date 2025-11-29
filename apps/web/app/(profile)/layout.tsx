import { type PropsWithChildren } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Footer from "components/sections/Footer"
import { getSession } from "lib/auth"

export default async function ProfileLayout({
  children,
}: PropsWithChildren<object>) {
  const session = await getSession({ headers: await headers() })
  if (!session) redirect("/signin")

  return (
    <>
      <main>
        <div className="container mx-auto min-h-screen px-2 pt-20">
          {children}
        </div>
      </main>
      {/* <Footer /> */}
    </>
  )
}
