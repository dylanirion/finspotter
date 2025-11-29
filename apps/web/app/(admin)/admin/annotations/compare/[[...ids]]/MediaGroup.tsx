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
  const spacing = layout === "horizontal" ? "space-x-1" : "space-y-1"
  const arrayChildren = Children.toArray(children)
  return (
    <div className={cn("flex", className, direction, spacing)}>
      {arrayChildren.map((child, i) => (
        <div key={i} className={layout === "horizontal" ? "w-2/5" : "h-2/5"}>
          {child}
        </div>
      ))}
    </div>
  )
}
