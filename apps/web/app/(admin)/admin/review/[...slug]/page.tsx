import { type Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
  dehydrate,
  HydrationBoundary,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import {
  getReviewClaim,
  getReviewComparison,
  getSingleMedia,
} from "app/_actions/pipeline"
import { Toaster } from "react-hot-toast"

import { ReviewCompare } from "../../annotations/compare/[[...ids]]/Compare"
import { MediaEditor } from "../../media/[id]/MediaEditor"
import { ReviewLease } from "./ReviewLease"

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
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>
  searchParams: Promise<{ review?: string }>
}) {
  const { slug: [mediaId, detectionId] = [] } = await params
  const { review: reviewId } = await searchParams
  if (!mediaId) notFound()
  const selectedDetectionId =
    detectionId === undefined ? undefined : Number(detectionId)
  if (selectedDetectionId !== undefined && !Number.isInteger(selectedDetectionId))
    notFound()
  const claim = reviewId ? await getReviewClaim(reviewId) : null
  if (reviewId && !claim) redirect("/dashboard")

  if (claim?.kind === "pair") {
    const comparison = await getReviewComparison(claim.id)
    return (
      <>
        <ReviewLease claim={claim} />
        <ReviewCompare comparison={comparison} reviewId={claim.id} />
        <Toaster position="bottom-right" reverseOrder={false} />
      </>
    )
  }

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
        {claim && <ReviewLease claim={claim} />}
        <MediaEditor
          id={mediaId}
          detectionId={selectedDetectionId}
          reviewId={claim?.kind === "detection" ? claim.id : undefined}
          variant="review"
        />
      </HydrationBoundary>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
