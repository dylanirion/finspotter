import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import {
  autoUpdate,
  flip,
  offset,
  Placement,
  shift,
  useFloating,
  useInteractions,
} from "@floating-ui/react"

interface PopoverOptions {
  placement?: Placement
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}

export function usePopover({
  placement = "bottom",
  open,
  setOpen,
}: PopoverOptions) {
  const [labelId, setLabelId] = useState<string | undefined>()
  const [descriptionId, setDescriptionId] = useState<string | undefined>()

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(5),
      flip({
        crossAxis: placement.includes("-"),
        fallbackAxisSideDirection: "end",
        padding: 5,
      }),
      shift({ padding: 5 }),
    ],
  })

  const interactions = useInteractions()

  return useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...data,
      labelId,
      descriptionId,
      setLabelId,
      setDescriptionId,
    }),
    [open, setOpen, data, labelId, descriptionId]
  )
}

type ContextType =
  | (ReturnType<typeof usePopover> & {
      setLabelId: Dispatch<SetStateAction<string | undefined>>
      setDescriptionId: Dispatch<SetStateAction<string | undefined>>
    })
  | null

export const PopoverContext = createContext<ContextType>(null)

export const usePopoverContext = () => {
  const context = useContext(PopoverContext)

  if (context == null) {
    throw new Error("Popover components must be wrapped in <Popover />")
  }

  return context
}
