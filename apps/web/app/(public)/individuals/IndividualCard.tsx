import Link from "next/link"
import { type IndividualSummary } from "@finspotter/core/individual"
import { CalendarIcon, EyeIcon, MapPinIcon } from "@heroicons/react/24/outline"
import { PhotoIcon } from "@heroicons/react/24/solid"
import { Badge } from "components/ui/badge/Badge"
import { Img } from "components/ui/images/Img"
import { Skeleton } from "components/ui/skeleton/Skeleton"

export function IndividualCard({ props }: { props: IndividualSummary }) {
  const { id, canonicalNames, nickNames, src, lastSeen } = props

  return (
    <Link className="group" href={`/individuals/${id}`}>
      <div className="w-80 shrink-0 grow-0 space-y-2 rounded-xl border px-6 py-2 text-left shadow group-hover:text-blue-600 group-focus:text-blue-600 sm:w-56 dark:border-gray-500 dark:bg-slate-700">
        <div className="flex items-center space-x-1">
          <h3 className="text-2xl font-bold">
            {canonicalNames &&
              canonicalNames.map((name) => <span key={name}>{name}</span>)}
          </h3>
          <div>
            {/* TODO: How to handle long names (HE_035)? maybe abbreviate all but last e.g H. B. de La Bath */}
            {nickNames &&
              nickNames.map((name) => (
                //TODO: user chosen badge colours
                <Badge
                  key={name}
                  variant="indigo"
                  className="text-xs font-medium"
                >
                  {name}
                </Badge>
              ))}
          </div>
        </div>
        <Img
          key={id}
          className="rounded object-cover"
          alt="Individual image"
          src={src!}
          fill
          priority
          sizes="(min-width: 640px) 14rem, 20rem" //NB: should reflect card width w-56
        />
        <div className="flex text-xs text-gray-400">
          {lastSeen && (
            <>
              <span className="mr-1 flex items-center">
                <CalendarIcon className="size-4" />
              </span>
              <span>{lastSeen}</span>
            </>
          )}
        </div>
        {/*
        <div className="flex text-xs text-gray-400">
          <span className="mr-1 flex items-center"><MapPinIcon className="w-4 h-4" /></span>
          <span>{location}</span>
        </div>
        */}
      </div>
    </Link>
  )
}

export function IndividualCardSkeleton() {
  return (
    <>
      <div
        className="w-80 shrink-0 grow-0 space-y-2 rounded-xl border px-6 py-2 text-left shadow sm:w-56 dark:border-gray-500 dark:bg-slate-700"
        role="status"
      >
        <Skeleton className="h-6 w-6/12 dark:bg-slate-700"></Skeleton>
        <Skeleton className="aspect-[4/3] w-full dark:bg-slate-500">
          <div className="flex size-full items-center justify-center">
            <PhotoIcon className="size-16 text-white" />
          </div>
        </Skeleton>
        <div className="flex animate-pulse">
          <span className="h-4 w-full rounded-md bg-gray-200 dark:bg-slate-700"></span>
        </div>
        <div className="flex animate-pulse">
          <span className="h-4 w-full rounded-md bg-gray-200 dark:bg-slate-700"></span>
        </div>
        <div className="flex animate-pulse">
          <span className="h-4 w-full rounded-md bg-gray-200 dark:bg-slate-700"></span>
        </div>
      </div>
    </>
  )
}
