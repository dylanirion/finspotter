import type { MaterializationStrategy } from "@finspotter/annotations/materialization"
import { defineAnnotation } from "@finspotter/annotations/registry"

export const name = "bbox_xywh"
export const packageName = "@finspotter/annotation-bbox_xywh"
export type Data = [number, number, number, number]
export type Display = { x: number; y: number }[]

export const materialize: MaterializationStrategy<Data> = ([
  x,
  y,
  width,
  height,
]) => ({
  sourceToDerived: { a: 1, b: 0, c: 0, d: 1, e: -x, f: -y },
  width,
  height,
})

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
