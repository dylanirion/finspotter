import {
  rotatedViewport,
  type MaterializationStrategy,
} from "@finspotter/annotations/materialization"
import { defineAnnotation } from "@finspotter/annotations/registry"

export const name = "bbox_xywha"
export const packageName = "@finspotter/annotation-bbox_xywha"
export type Data = [number, number, number, number, number]
export type Display = { x: number; y: number }[]

export const materialize: MaterializationStrategy<Data> = ([
  xc,
  yc,
  width,
  height,
  angle,
]) => rotatedViewport(xc, yc, width, height, angle)

export const annotation = defineAnnotation<
  typeof name,
  Data,
  Display,
  typeof packageName
>({
  name,
  packageName,
  materialize,
})
