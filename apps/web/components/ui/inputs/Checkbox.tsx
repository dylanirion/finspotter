import { type ComponentPropsWithRef } from "react"
import { Checkbox as Root } from "@headlessui/react"
import { CheckIcon } from "@heroicons/react/24/outline"
import { cn } from "lib/utils"

export function Checkbox({
  ref,
  className,
  ...props
}: ComponentPropsWithRef<typeof Root>) {
  return (
    <Root ref={ref} className={cn("group shrink-0", className)} {...props}>
      <CheckIcon className="hidden stroke-[3px] group-data-checked:block" />
    </Root>
  )
}
