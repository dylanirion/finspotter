import { type PropsWithChildren } from "react"
import {
  BaseAnnotationLayer,
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

import { strategy } from "./strategy"

export { BaseEditPopover as EditPopover } from "@finspotter/annotations/react/BaseEditPanel"
export { Icon } from "./Icon"

export function EditPanel<T extends "bbox_xywha$segmentation">(
  props: PropsWithChildren<Omit<BaseEditPanelProps<T>, "strategy">>
) {
  return <BaseEditPanel {...props} strategy={strategy} />
}

export function AnnotationLayer<
  T extends "bbox_xywha$segmentation",
  E extends boolean = false,
>(props: Omit<BaseAnnotationLayerProps<T, E>, "strategy">) {
  return <BaseAnnotationLayer {...props} strategy={strategy} />
}

export const EditPanelButtons = {
  Test: EditPanelButton,
  Category: CategoryListbox,
  Save: SaveButton<"bbox_xywha$segmentation">,
  Delete: DeleteButton<"bbox_xywha$segmentation">,
  Convert: ConvertButton<"bbox_xywha$segmentation">,
}

export const convertFrom = strategy.convert
export const getTransformMatrix = strategy.getTransformMatrix
