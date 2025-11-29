import { Suspense } from "react"
import { type Metadata } from "next"
import { DataTableSkeleton } from "components/ui/table/DataTable"

import { IndividualsTabPanel } from "./IndividualsTabPanel"

export const metadata: Metadata = {
  title: "Individuals",
}

//TODO: prefetch this and make it SSR? not sure if cloudfront will cache that?
export default function AllIndividualsPage() {
  return (
    <Suspense fallback={<DataTableSkeleton rows={12} />}>
      <IndividualsTabPanel />
    </Suspense>
  )
}
