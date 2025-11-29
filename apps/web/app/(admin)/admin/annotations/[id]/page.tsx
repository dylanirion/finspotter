import { type Metadata } from "next"
import { notFound } from "next/navigation"
import {
  dehydrate,
  HydrationBoundary,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import { getSingleAnnotation } from "app/_actions/annotations"
import { Toaster } from "react-hot-toast"

import { Annotation } from "./Annotation"

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> => {
  const { id } = await params
  return {
    title: `Annotation - ${id}`,
  }
}

export default async function SingleAnnotationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) notFound()

  const queryClient = new QueryClient({
    queryCache: new QueryCache(),
  })
  const media = await queryClient.fetchQuery({
    queryKey: ["annotation", id],
    queryFn: () => getSingleAnnotation(id),
  })
  if (!media) notFound()
  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="inline">Annotation</span>{" "}
          <span className="inline text-indigo-600">{id}</span>
        </h1>
        {/* <MediaEditor id={id} /> */}
      </HydrationBoundary>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
