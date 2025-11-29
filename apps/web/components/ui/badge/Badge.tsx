import { type HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "lib/utils"

export const standardBadgeVariants = [
  "neutral",
  "red",
  "yellow",
  "green",
  "blue",
  "indigo",
] as const
export const customBadgeVariants = [
  "blue",
  "violet",
  "rose",
  "orange",
  "amber",
] as const

type badgeVariants = typeof standardBadgeVariants | typeof customBadgeVariants

export const badgeStyles = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        neutral: [
          "border-transparent",
          "bg-neutral-50",
          "text-gray-600",
          "dark:bg-neutral-500",
          "dark:text-neutral-50",
        ],
        red: [
          "border-transparent",
          "bg-red-50",
          "text-red-700",
          "dark:bg-red-500",
          "dark:text-red-50",
        ],
        yellow: [
          "border-transparent",
          "bg-yellow-50",
          "text-yellow-800",
          "dark:bg-yellow-500",
          "dark:text-yellow-50",
        ],
        green: [
          "border-transparent",
          "bg-green-50",
          "text-green-700",
          "dark:bg-green-500",
          "dark:text-green-50",
        ],
        blue: [
          "border-transparent",
          "bg-blue-50",
          "text-blue-700",
          "dark:bg-blue-500",
          "dark:text-blue-50",
        ],
        indigo: [
          "border-transparent",
          "bg-indigo-50",
          "text-indigo-700",
          "dark:bg-indigo-500",
          "dark:text-indigo-50",
        ],
        violet: [
          "border-transparent",
          "bg-violet-50",
          "text-violet-700",
          "dark:bg-violet-500",
          "dark:text-violet-50",
        ],
        rose: [
          "border-transparent",
          "bg-rose-50",
          "text-rose-700",
          "dark:bg-rose-500",
          "dark:text-rose-50",
        ],
        orange: [
          "border-transparent",
          "bg-orange-50",
          "text-orange-700",
          "dark:bg-orange-500",
          "dark:text-orange-50",
        ],
        amber: [
          "border-transparent",
          "bg-amber-50",
          "text-amber-700",
          "dark:bg-amber-500",
          "dark:text-amber-50",
        ],
      } as { [key in badgeVariants[number]]: string[] },
    },
    defaultVariants: {
      variant: "indigo",
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeStyles> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeStyles({ variant }), className)} {...props} />
}
