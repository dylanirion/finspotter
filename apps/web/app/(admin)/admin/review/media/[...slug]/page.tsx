import { type Metadata } from "next"
import { notFound } from "next/navigation"
import {
  dehydrate,
  HydrationBoundary,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import { getSingleMedia } from "app/_actions/pipeline"
import { Toaster } from "react-hot-toast"

import { MediaEditor } from "./MediaEditor"

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> => {
  const { slug: [mediaId] = [] } = await params
  return {
    title: `Review Media - ${mediaId}`,
  }
}

export default async function SingleMediaReviewPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug: [mediaId] = [] } = await params
  if (!mediaId) notFound()

  const queryClient = new QueryClient({
    queryCache: new QueryCache(),
  })
  //TODO: this needs to cache annotation infinitely, otherwise it refires on tab refocus
  const media = await queryClient.fetchQuery({
    queryKey: ["media", mediaId],
    queryFn: () => getSingleMedia(mediaId),
  })
  if (!media) notFound()
  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="inline">Media</span>{" "}
          <span className="inline text-indigo-600">{mediaId}</span>
        </h1>
        <MediaEditor id={mediaId} />
      </HydrationBoundary>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
