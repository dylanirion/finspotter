import { type Metadata } from "next"
import { notFound } from "next/navigation"
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query"
import {
  getCanonicalNames,
  getSingleIndividual,
} from "app/_actions/individuals"
import { Badge } from "components/ui/badge/Badge"
import { DataTableSkeleton } from "components/ui/table/DataTable"

import { IndividualPanel } from "./IndividualPanel"

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> => {
  const { id } = await params
  const names = await getCanonicalNames(id)
  return {
    title: `Individual ${names ? `- ${names.canonical[0]}` : ""}`,
  }
}

export default async function SingleIndividualPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const queryClient = new QueryClient()
  const individual = await queryClient.fetchQuery({
    queryKey: ["individual", id],
    queryFn: () => getSingleIndividual(id),
    staleTime: Infinity,
  })

  if (!individual) notFound()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mr-1 inline-flex truncate text-indigo-600">
        <h1 className="text-2xl font-bold tracking-tight">
          {individual.names.canonical?.map((name, i) => [
            i > 0 && ", ",
            <span key={i} className="inline">
              {name}
            </span>,
          ])}
        </h1>
      </div>
      <div className="inline-flex truncate">
        {individual.names.nickname?.map((name, i) => (
          <Badge key={i} className="mr-1 text-2xl">
            {name}
          </Badge>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-4 lg:grid lg:flex-none lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IndividualPanel encounters={individual.encounters} />
        </div>

        <div className="flex flex-row gap-4 lg:flex-col">
          <div className="flex aspect-square w-1/2 items-center justify-center rounded-md border bg-white shadow-md lg:w-full dark:border-slate-600 dark:bg-slate-700">
            Map Component
          </div>
          <div className="flex grow items-center justify-center rounded-md border bg-white shadow-md dark:border-slate-600 dark:bg-slate-700">
            Some Other Component
          </div>
        </div>
      </div>
      <h1 className="text-xl font-bold tracking-tight">Encounters</h1>
      <div className="mt-4 flex items-center justify-center rounded-md shadow-md">
        <DataTableSkeleton rows={6} />
      </div>
    </HydrationBoundary>
  )
}
