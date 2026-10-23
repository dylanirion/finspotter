import { useState, type ComponentProps } from "react"
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline"

export function Password({
  ref,
  id = "password",
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [isVisible, setIsVisible] = useState(false)

  const toggleVisibility = () => setIsVisible((prevState) => !prevState)

  return (
    <div className="relative">
      <input
        ref={ref}
        type={isVisible ? "text" : "password"}
        className={className}
        {...props}
      />
      <button
        className="absolute inset-y-0 inset-e-0 z-20 flex cursor-pointer items-center rounded-e-md px-2.5 text-gray-400 transition-colors hover:text-indigo-500 focus:outline-none"
        type="button"
        onClick={toggleVisibility}
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        aria-controls={id}
      >
        {isVisible ? (
          <EyeSlashIcon className="size-5" aria-hidden="true" />
        ) : (
          <EyeIcon className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
