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

export function EditPanel<T extends "segmentation">(
  props: PropsWithChildren<Omit<BaseEditPanelProps<T>, "strategy">>
) {
  return <BaseEditPanel {...props} strategy={strategy} />
}

export function AnnotationLayer<
  T extends "segmentation",
  E extends boolean = false,
>(props: Omit<BaseAnnotationLayerProps<T, E>, "strategy">) {
  return <BaseAnnotationLayer {...props} strategy={strategy} />
}

export const EditPanelButtons = {
  Edit: EditShapeButton,
  Category: CategoryListbox,
  Save: SaveButton<"segmentation">,
  Delete: DeleteButton<"segmentation">,
  Convert: ConvertButton<"segmentation">,
}

function selectEditingState(state: StateFrom<typeof strategy.machine>) {
  return (
    state.matches({ active: "editing" }) || state.matches({ active: "editing" })
  )
}

function EditShapeButton() {
  const { stateMachine } = useAnnotation<"segmentation">()

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
      inActiveText="Edit Shape"
      onClick={toggleEditShape}
      Icon={PencilSquareIcon}
    />
  )
}

export const convertFrom = strategy.convert
export const getTransformMatrix = strategy.getTransformMatrix
