import { type PropsWithChildren } from "react"

export function SimpleCTA({
  className,
  title,
  subtitle,
  children,
}: PropsWithChildren<{ className: string; title: string; subtitle: string }>) {
  return (
    <div className={className}>
      <div className="relative mx-4 rounded-lg">
        <div className="absolute -inset-1 bg-gradient-to-r from-green-300 via-blue-500 to-purple-600 opacity-25 blur"></div>
        <div className="relative rounded-lg bg-white dark:bg-slate-600">
          <div className="mx-auto max-w-7xl p-4 sm:px-6 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:px-8">
            <h2 className="block text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="block">{title}</span>
              <span className="block bg-gradient-to-r from-green-300 via-blue-500 to-purple-600 bg-clip-text py-1 text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {subtitle}
              </span>
            </h2>
            <div className="mt-8 flex flex-col gap-3 md:flex-row lg:mt-0 lg:shrink-0">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
