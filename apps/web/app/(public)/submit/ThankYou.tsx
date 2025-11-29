import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "hooks/useSession"

import { useSubmission } from "./EncounterSubmissionContext"

//TODO: link to submit more
//TODO explain next steps
export function ThankYou({ title }: { title: string }) {
  const _title = title
  const { data } = useSubmission()
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      router.push("/dashboard")
    }, 3000)

    return () => clearTimeout(timer)
  }, [router, user])

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Thank You!</h1>
      {!user && <span>Please check your email to verify your submission.</span>}
      {user && (
        <span>
          You will be redirected to your dashboard where you can review your
          submission shortly!
        </span>
      )}
    </>
  )
}
