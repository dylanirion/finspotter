import { DemoGrid } from "./SelectImageStep"

export function DetectionFailedStep() {
  return (
    <>
      <h2 className="text-lg leading-8 font-semibold tracking-tight text-indigo-600">
        Detection
      </h2>
      <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Oops!
      </p>
      <div className="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
        We couldn&apos;t find a shark in that image. Are you sure you don&apos;t
        want to use one of ours below?
      </div>
      <DemoGrid />
    </>
  )
}
