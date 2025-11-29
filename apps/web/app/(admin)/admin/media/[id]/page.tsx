import { type Metadata } from "next"
import { notFound } from "next/navigation"
import {
  dehydrate,
  HydrationBoundary,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import { getSingleMedia } from "app/_actions/media"
import { Toaster } from "react-hot-toast"

import { MediaEditor } from "./MediaEditor"

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> => {
  const { id } = await params
  return {
    title: `Media - ${id}`,
  }
}

export default async function SingleMediaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) notFound()

  const queryClient = new QueryClient({
    queryCache: new QueryCache(),
  })
  //TODO: this needs to cache annotation infinitely, otherwise it refires on tab refocus
  const media = await queryClient.fetchQuery({
    queryKey: ["media", id],
    queryFn: () => getSingleMedia(id),
  })
  if (!media) notFound()
  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="inline">Media</span>{" "}
          <span className="inline text-indigo-600">{id}</span>
        </h1>
        <MediaEditor id={id} />
      </HydrationBoundary>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
