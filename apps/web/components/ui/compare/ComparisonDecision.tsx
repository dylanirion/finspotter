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
        intent="none"
        size="small"
        className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 font-medium text-emerald-900 shadow-sm hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
        disabled={decide.isPending}
        onClick={() => decide.mutate("same")}
      >
        <CheckIcon className="size-4" />
        Same individual
      </Button>
      <Button
        intent="none"
        size="small"
        className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 font-medium text-rose-900 shadow-sm hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900"
        disabled={decide.isPending}
        onClick={() => decide.mutate("different")}
      >
        <XMarkIcon className="size-4" />
        Different individuals
      </Button>
      <Button
        intent="none"
        size="small"
        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 font-medium text-amber-900 shadow-sm hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
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
