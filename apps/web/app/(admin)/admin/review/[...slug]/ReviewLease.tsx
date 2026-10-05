"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline"
import { useMutation } from "@tanstack/react-query"
import {
  releaseReviewClaim,
  renewReviewClaim,
  type ReviewClaim,
} from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { toast } from "react-hot-toast"

const RENEW_INTERVAL_MS = 2 * 60 * 1000

export function ReviewLease({ claim }: { claim: ReviewClaim }) {
  const router = useRouter()
  const [expiresAt, setExpiresAt] = useState(claim.claimExpiresAt)
  const release = useMutation({
    mutationFn: () => releaseReviewClaim(claim.id),
    onSuccess: () => router.push("/dashboard"),
    onError: () => toast.error("Unable to release this review item."),
  })

  useEffect(() => {
    const renew = async () => {
      try {
        const renewed = await renewReviewClaim(claim.id)
        setExpiresAt(renewed.claimExpiresAt)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Your review claim expired."
        )
        router.replace("/dashboard")
      }
    }
    const interval = window.setInterval(renew, RENEW_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [claim.id, router])

  return (
    <div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-2 border-y border-cyan-200 bg-cyan-50 px-2 py-1.5 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
      <span className="inline-flex items-center gap-2">
        <ClockIcon className="size-4" />
        {claim.kind.replace("_", " ")} claimed until{" "}
        <time className="font-mono text-xs tabular-nums" dateTime={expiresAt}>
          {new Intl.DateTimeFormat("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date(expiresAt))}
        </time>
      </span>
      <Button
        intent="none"
        size="small"
        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-medium text-cyan-900 hover:bg-cyan-100 disabled:opacity-50 dark:text-cyan-100 dark:hover:bg-cyan-900"
        disabled={release.isPending}
        onClick={() => release.mutate()}
      >
        <ArrowLeftIcon className="size-4" />
        Back to queue
      </Button>
    </div>
  )
}
