import { type Metadata } from "next"
import {
  dehydrate,
  HydrationBoundary,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import { getSingleAnnotation } from "app/_actions/annotations"
import { Compare } from "components/ui/compare/Compare"
import { Toaster } from "react-hot-toast"

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ ids?: string[] }>
}): Promise<Metadata> => {
  const { ids } = await params
  return {
    title: `Compare ${ids?.length == 2 ? `- ${ids[0]} : ${ids[1]}` : ""}`,
  }
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ ids?: string[] }>
}) {
  const { ids } = await params

  //TODO: more informative error, or allow a way to select ids?
  if (ids?.length !== 2) return <div>Missing ids!</div>
  const annotationIds: [string, string] = [ids[0]!, ids[1]!]

  const queryClient = new QueryClient({
    queryCache: new QueryCache(),
  })

  await Promise.all(
    annotationIds.map((id) =>
      queryClient.prefetchQuery({
        queryKey: ["annotation", id],
        queryFn: () => getSingleAnnotation(id),
      })
    )
  )

  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Compare ids={annotationIds} />
      </HydrationBoundary>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
