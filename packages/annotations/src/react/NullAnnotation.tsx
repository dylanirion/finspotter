import { type PropsWithChildren } from "react"

import { strategy } from "../null/strategy"
import {
  BaseAnnotationLayer,
  type BaseAnnotationLayerProps,
} from "./BaseAnnotationLayer"
import { BaseEditPanel, type BaseEditPanelProps } from "./BaseEditPanel"
import {
  CategoryListbox,
  ConvertButton,
  DeleteButton,
  SaveButton,
} from "./EditPanelButton"

export { BaseEditPopover as EditPopover } from "@finspotter/annotations/react/BaseEditPanel"

export function AnnotationLayer<
  T extends "null" = "null",
  E extends boolean = false,
>(props: Omit<BaseAnnotationLayerProps<T, E>, "strategy">) {
  return <BaseAnnotationLayer {...props} strategy={strategy} />
}

export function EditPanel<T extends "null">(
  props: PropsWithChildren<Omit<BaseEditPanelProps<T>, "strategy">>
) {
  return <BaseEditPanel {...props} strategy={strategy} />
}

export const EditPanelButtons = {
  Category: CategoryListbox,
  Save: SaveButton<"null">,
  Delete: DeleteButton<"null">,
  Convert: ConvertButton<"null">,
}

export const convertFrom = strategy.convert
export const getTransformMatrix = strategy.getTransformMatrix
