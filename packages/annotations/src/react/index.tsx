import {
  ForwardRefExoticComponent,
  RefAttributes,
  SVGProps,
  type ComponentType,
  type PropsWithChildren,
} from "react"
import {
  type AnnotationDataTypes,
  type AnnotationType,
} from "@finspotter/annotations"
import { type Transform } from "@finspotter/canvas"

import { annotationModules } from "./annotations.config"
import {
  type BaseAnnotationLayerProps,
  type ConvertTo,
} from "./BaseAnnotationLayer"
import { type BaseEditPanelProps } from "./BaseEditPanel"
import {
  type OptionalButton,
  type RequiredButtonProps,
} from "./EditPanelButton"
import * as nullAnnotation from "./NullAnnotation"

type AnnotationLayerProps<T extends AnnotationType | "null"> = Omit<
  BaseAnnotationLayerProps<T>,
  "strategy"
>

type EditPanelProps<T extends AnnotationType | "null"> = PropsWithChildren<
  Omit<BaseEditPanelProps<T>, "strategy">
>

type AnnotationModule<T extends AnnotationType | "null"> = {
  AnnotationLayer: ComponentType<AnnotationLayerProps<T>>
  EditPopover: ComponentType<object>
  EditPanel: ComponentType<EditPanelProps<T>>
  EditPanelButtons: RequiredButtonProps<T> & OptionalButton
  convertFrom?: ConvertTo<T>
  getTransformMatrix: (
    arg0: T extends AnnotationType ? AnnotationDataTypes[T] : null
  ) => Transform
  Icon?: ForwardRefExoticComponent<
    Omit<
      SVGProps<SVGSVGElement> & {
        title?: string
        titleId?: string
      },
      "ref"
    > &
      RefAttributes<SVGSVGElement>
  >
}

const modules: { [T in AnnotationType | "null"]: AnnotationModule<T> } = {
  ...annotationModules,
  null: nullAnnotation,
}

export function getAnnotationComponents<T extends AnnotationType | "null">(
  type: T
): AnnotationModule<T> & {
  convertTo?: Partial<{
    [K in Exclude<AnnotationType | "null", T>]: ConvertTo<K>[T]
  }>
} {
  if (!modules[type])
    throw new Error(`No module found for annotation type '${type}'!`)

  const module = modules[type] as AnnotationModule<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertTo: Record<string, ConvertTo<any>> = {}
  for (const [targetTypeStr, targetModule] of Object.entries(modules)) {
    if (targetTypeStr === type) continue
    const targetType = targetTypeStr as Exclude<AnnotationType | "null", T>
    if (
      targetModule?.convertFrom?.[
        type as keyof typeof targetModule.convertFrom
      ] !== undefined
    ) {
      convertTo[targetType] =
        targetModule!.convertFrom[type as keyof typeof targetModule.convertFrom]
    }
  }

  return {
    ...module,
    convertTo: Object.keys(convertTo).length
      ? (convertTo as Partial<{
          [K in Exclude<AnnotationType | "null", T>]: ConvertTo<K>[T]
        }>)
      : undefined,
  }
}
