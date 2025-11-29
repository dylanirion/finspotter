import { type PropsWithChildren } from "react"

export function Fold({
  className,
  children,
}: PropsWithChildren<{
  className?: string
}>) {
  //TODO: svh instead of dvh? think more about how this should behave.
  return (
    <div className="w-full xl:min-h-[calc(100svh_-_5rem)]">
      <div className={className}>{children}</div>
    </div>
  )
}
