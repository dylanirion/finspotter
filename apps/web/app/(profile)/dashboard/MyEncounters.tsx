import Link from "next/link"
import { createSubmissionRepository } from "@finspotter/core/submission"
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/ui/table/Table"

export async function MyEncounters({ userId }: { userId: string }) {
  const submissions =
    await createSubmissionRepository().findRecentByUser(userId)

  return (
    <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
      <h3>My Encounters</h3>
      {submissions.length ? (
        <div className="overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-700">
          <Table className="table-fixed">
            <TableHeader className="bg-gray-50 dark:bg-slate-700">
              <TableRow className="border-gray-300 dark:border-slate-500">
                <TableHead className="h-8 w-2/5 px-2">Encounter</TableHead>
                <TableHead className="h-8 w-1/4 px-2">Submitted</TableHead>
                <TableHead className="h-8 px-2">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-slate-900">
              {submissions.map((submission) => {
                const rejected = submission.state === "rejected"
                const identified = !rejected && Boolean(submission.individualId)
                const status = rejected
                  ? "Rejected"
                  : identified
                    ? "Identified"
                    : submission.state === "pending"
                      ? "Pending review"
                      : submission.annotationId
                        ? "Pending identification"
                        : "Reviewed"
                const StatusIcon = rejected
                  ? XCircleIcon
                  : identified || status === "Reviewed"
                    ? CheckCircleIcon
                    : ClockIcon

                return (
                  <TableRow
                    key={submission.annotationId ?? submission.mediaId}
                    className="border-gray-200 dark:border-slate-700"
                  >
                    <TableCell className="px-2 py-3 wrap-break-word">
                      <span className="block">
                        {identified
                          ? (submission.name ?? "Identified individual")
                          : submission.annotationId
                            ? "Unidentified individual"
                            : "Submitted media"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {submission.mediaId.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-xs">
                      {submission.submittedAt ? (
                        <time dateTime={submission.submittedAt.toISOString()}>
                          {submission.submittedAt.toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </time>
                      ) : (
                        "Unknown"
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <span className="flex items-start gap-1.5">
                        <StatusIcon
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0"
                        />
                        {status}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="py-6 text-sm">
          <p>No encounters submitted yet.</p>
          <Link
            href="/submit"
            className="mt-2 inline-block text-blue-600 underline dark:text-blue-400"
          >
            Submit photos
          </Link>
        </div>
      )}
    </div>
  )
}
