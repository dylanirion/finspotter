import { Suspense } from "react"
import { type Metadata } from "next"
import { DataTableSkeleton } from "components/ui/table/DataTable"
import { Toaster } from "react-hot-toast"

import { AnnotationsTable } from "./AnnotationsTable"

export const metadata: Metadata = {
  title: "Annotations",
}

export default function AllAnnotationsPage() {
  return (
    <>
      <Suspense fallback={<DataTableSkeleton rows={12} />}>
        <AnnotationsTable />
      </Suspense>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
