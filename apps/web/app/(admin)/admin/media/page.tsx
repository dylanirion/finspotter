import { Suspense } from "react"
import { type Metadata } from "next"
import { DataTableSkeleton } from "components/ui/table/DataTable"
import { Toaster } from "react-hot-toast"

import { MediaTable } from "./MediaTable"

export const metadata: Metadata = {
  title: "Media",
}

export default function AllMediaPage() {
  return (
    <>
      <Suspense fallback={<DataTableSkeleton rows={12} />}>
        <MediaTable />
      </Suspense>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
