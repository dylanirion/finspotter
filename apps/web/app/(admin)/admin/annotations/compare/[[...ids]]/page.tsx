import { type Metadata } from "next"
import {
  dehydrate,
  HydrationBoundary,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import { getSingleAnnotation } from "app/_actions/annotations"
import { Toaster } from "react-hot-toast"

import { Compare } from "./Compare"

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ ids: [string, string] }>
}): Promise<Metadata> => {
  const { ids } = await params
  return {
    title: `Compare ${ids?.length == 2 ? `- ${ids[0]} : ${ids[1]}` : ""}`,
  }
}

//TEMPORARY TEST
const ids: [string, string] = [
  "b4a95cd6-6205-4efa-9160-b8359f9b4ea6", // 19643 - 70zlTQ8WzEXg97Wvg9r
  "4385b384-c4a1-4927-8dbf-7ad82888af5f", // 19303 - pPOw_71i_1XGE4dvWHG
]
//END

export default async function ComparePage({
  params,
}: {
  params: Promise<{ ids: [string, string] }>
}) {
  //const { ids } = await params

  //TODO: more informative error, or allow a way to select ids?
  if (ids?.length !== 2) return <div>Missing ids!</div>

  const queryClient = new QueryClient({
    queryCache: new QueryCache(),
  })

  await Promise.all(
    ids.map((id) =>
      queryClient.prefetchQuery({
        queryKey: ["annotation", id],
        queryFn: () => getSingleAnnotation(id),
      })
    )
  )

  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Compare ids={ids} />
      </HydrationBoundary>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
