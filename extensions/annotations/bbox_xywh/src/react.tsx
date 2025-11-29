import { type MouseEvent, type PropsWithChildren } from "react"
import {
  BaseAnnotationLayer,
  useAnnotation,
  type BaseAnnotationLayerProps,
} from "@finspotter/annotations/react/BaseAnnotationLayer"
import {
  BaseEditPanel,
  type BaseEditPanelProps,
} from "@finspotter/annotations/react/BaseEditPanel"
import {
  CategoryListbox,
  ConvertButton,
  DeleteButton,
  EditPanelButton,
  SaveButton,
} from "@finspotter/annotations/react/EditPanelButton"
import { PencilSquareIcon } from "@heroicons/react/24/outline"
import { useSelector } from "@xstate/react"
import { type Actor, type StateFrom } from "xstate"

import { strategy } from "./strategy"

export { BaseEditPopover as EditPopover } from "@finspotter/annotations/react/BaseEditPanel"
export { Icon } from "./Icon"

export function AnnotationLayer<
  T extends "bbox_xywh" = "bbox_xywh",
  E extends boolean = false,
>(props: Omit<BaseAnnotationLayerProps<T, E>, "strategy">) {
  return <BaseAnnotationLayer {...props} strategy={strategy} />
}

export function EditPanel<T extends "bbox_xywh">(
  props: PropsWithChildren<Omit<BaseEditPanelProps<T>, "strategy">>
) {
  return <BaseEditPanel {...props} strategy={strategy} />
}

export const EditPanelButtons = {
  Edit: EditBoxButton,
  Category: CategoryListbox,
  Save: SaveButton<"bbox_xywh">,
  Delete: DeleteButton<"bbox_xywh">,
  Convert: ConvertButton<"bbox_xywh">,
}

function selectEditingState(state: StateFrom<typeof strategy.machine>) {
  return (
    state.matches({ active: "editing" }) || state.matches({ active: "editing" })
  )
}

function EditBoxButton() {
  const { stateMachine } = useAnnotation<"bbox_xywh">()

  const toggleEditShape = (e: MouseEvent) => {
    e.nativeEvent.stopPropagation()
    stateMachine.send({ type: "toggle.edit" })
  }

  const isActive = useSelector(
    stateMachine as Actor<typeof strategy.machine>,
    selectEditingState
  )

  return (
    <EditPanelButton
      isActive={isActive}
      activeText="Finish"
      inActiveText="Edit Box"
      onClick={toggleEditShape}
      Icon={PencilSquareIcon}
    />
  )
}

export const convertFrom = strategy.convert
export const getTransformMatrix = strategy.getTransformMatrix
