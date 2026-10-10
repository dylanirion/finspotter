import { Children } from "react"
import { cn } from "lib/utils"

interface MediaGroupProps {
  className?: string
  layout?: "horizontal" | "vertical"
  children?: React.ReactNode
}

export function MediaGroup({
  className,
  layout = "horizontal",
  children,
}: MediaGroupProps) {
  const direction = layout === "horizontal" ? "flex-row" : "flex-col"
  const arrayChildren = Children.toArray(children)
  return (
    <div className={cn("flex w-full gap-2", className, direction)}>
      {arrayChildren.map((child, i) => (
        <div
          key={i}
          className={layout === "horizontal" ? "min-w-0 flex-1" : "w-full"}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
