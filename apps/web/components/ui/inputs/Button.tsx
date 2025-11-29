import { type ButtonHTMLAttributes, type DetailedHTMLProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"

//TODO: this is prematurely optimised?
//TODO: it also appends class even if it is undefined
const buttonStyles = cva([], {
  variants: {
    intent: {
      primary:
        "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
      secondary:
        "bg-indigo-200 text-indigo-600 hover:bg-indigo-300 focus:ring-indigo-100",
      none: [],
    },
    size: {
      small: "px-2 py-1 text-sm",
      medium: "px-4 py-2 text-base",
      large: "px-8 py-3 text-base md:px-10 md:py-4 md:text-lg",
      icon: "size-9",
      none: [],
    },
    fullWidth: {
      true: "w-full",
    },
  },
  compoundVariants: [
    {
      intent: ["primary", "secondary"],
      size: ["large", "medium", "small"],
      className:
        "rounded-md border border-transparent font-medium shadow focus:outline-hidden focus:ring-2 focus:ring-offset-2",
    },
  ],
  defaultVariants: {
    intent: "primary",
    size: "medium",
  },
})

export function Button({
  ref,
  className,
  type = "button",
  intent,
  size,
  fullWidth,
  children,
  ...props
}: VariantProps<typeof buttonStyles> &
  DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ intent, size, fullWidth, className })}
      {...props}
    >
      {children}
    </button>
  )
}
