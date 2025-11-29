import { type Metadata } from "next"
import { headers } from "next/headers"
import {
  dehydrate,
  HydrationBoundary,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import { CaptchaProvider } from "contexts/Captcha"
import { getSession, listOrganizations } from "lib/auth"
import { Toaster } from "react-hot-toast"

import { EncounterSubmissionProvider } from "./EncounterSubmissionContext"
import { EncounterSubmissionForm } from "./EncounterSubmissionForm"

export const metadata: Metadata = {
  title: "Submit Your Encounters!",
}

export default async function SubmitPage() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache(),
  })

  const session = await queryClient.fetchQuery({
    queryKey: ["session"],
    queryFn: async () => await getSession({ headers: await headers() }),
    staleTime: 60 * 1000, // 1 minute
  })

  if (session?.user) {
    await queryClient.prefetchQuery({
      queryKey: ["organizations"],
      queryFn: async () =>
        await listOrganizations({ headers: await headers() }),
      staleTime: 60 * 1000, // 1 minute
    })
  }

  return (
    <>
      <CaptchaProvider>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <EncounterSubmissionProvider>
            <EncounterSubmissionForm />
          </EncounterSubmissionProvider>
        </HydrationBoundary>
      </CaptchaProvider>
      <Toaster position="bottom-right" reverseOrder={false} />
    </>
  )
}
