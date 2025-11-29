import { type Metadata } from "next"
import { headers } from "next/headers"
import { getSession } from "lib/auth"

export const metadata: Metadata = {
  title: "Profile",
}

export default async function ProfilePage() {
  const session = await getSession({ headers: await headers() })

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Session</h1>
      <pre>{JSON.stringify(session!.user, null, 2)}</pre>
    </>
  )
}
