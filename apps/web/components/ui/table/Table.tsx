import { type HTMLProps } from "react"
import { cn } from "lib/utils"

export function Table({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

export function TableHeader({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableSectionElement>) {
  return (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  )
}

export function TableBody({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableSectionElement>) {
  return (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

export function TableFooter({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableSectionElement>) {
  return (
    <tfoot
      ref={ref}
      className={cn("border-t font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

export function TableRow({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableRowElement>) {
  return <tr ref={ref} className={cn("border-b", className)} {...props} />
}

export function TableHead({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableCellElement>) {
  return (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

export function TableCell({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableCellElement>) {
  return (
    <td
      ref={ref}
      className={cn(
        "p-4 align-middle [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

export function TableCaption({
  ref,
  className,
  ...props
}: HTMLProps<HTMLTableCaptionElement>) {
  return (
    <caption ref={ref} className={cn("mt-4 text-sm", className)} {...props} />
  )
}
