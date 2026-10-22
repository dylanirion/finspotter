"use client"

import { useRouter } from "next/navigation"
import {
  CheckIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { useMutation } from "@tanstack/react-query"
import { decideReviewComparison } from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { toast } from "react-hot-toast"

// Mirrors the comparison_verdict enum in @finspotter/core/comparisonDecision.
// Declared locally so this client component never pulls in the server-only
// database module.
type Verdict = "same" | "different" | "inconclusive"

const MESSAGES: Record<Verdict, string> = {
  same: "Recorded as the same individual.",
  different: "Recorded as different individuals.",
  inconclusive: "Recorded as not enough information.",
}

/**
 * Decision controls for a claimed comparison review. Shared by locally
 * generated pairs and indexed search matches, both of which resolve to the
 * same durable comparison decision edge.
 */
export function ComparisonDecision({ reviewId }: { reviewId: string }) {
  const router = useRouter()
  const decide = useMutation({
    mutationFn: (verdict: Verdict) => decideReviewComparison(reviewId, verdict),
    onSuccess: (_, verdict) => {
      toast.success(MESSAGES[verdict])
      router.push("/dashboard")
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to record this decision."
      ),
  })

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
      <Button
        intent="approve"
        size="small"
        className="inline-flex items-center gap-2 disabled:opacity-50"
        disabled={decide.isPending}
        onClick={() => decide.mutate("same")}
      >
        <CheckIcon className="size-4" />
        Same individual
      </Button>
      <Button
        intent="reject"
        size="small"
        className="inline-flex items-center gap-2 disabled:opacity-50"
        disabled={decide.isPending}
        onClick={() => decide.mutate("different")}
      >
        <XMarkIcon className="size-4" />
        Different individuals
      </Button>
      <Button
        intent="abstain"
        size="small"
        className="inline-flex items-center gap-2 disabled:opacity-50"
        disabled={decide.isPending}
        onClick={() => decide.mutate("inconclusive")}
      >
        <QuestionMarkCircleIcon className="size-4" />
        Not enough information
      </Button>
      <p className="w-full text-center text-xs text-gray-500 dark:text-slate-400">
        Use <span className="font-medium">Back to queue</span> to release this
        item without recording any decision.
      </p>
    </div>
  )
}
