import {
  polygonViewport,
  type MaterializationStrategy,
} from "@finspotter/annotations/materialization"
import { defineAnnotation } from "@finspotter/annotations/registry"

export const name = "segmentation"
export const packageName = "@finspotter/annotation-segmentation"
export type Data = number[][]
export type Display = { x: number; y: number }[][]

export const materialize: MaterializationStrategy<Data> = (polygons) =>
  polygonViewport(polygons)

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
