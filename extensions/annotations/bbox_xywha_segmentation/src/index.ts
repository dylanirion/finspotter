import {
  rotatedViewport,
  type MaterializationStrategy,
} from "@finspotter/annotations/materialization"
import { defineAnnotation } from "@finspotter/annotations/registry"

export const name = "bbox_xywha$segmentation"
export const packageName = "@finspotter/annotation-bbox_xywha_segmentation"

export type Data = {
  bbox_xywha: [number, number, number, number, number]
  segmentation: number[][]
}

export type Display = {
  bbox_xywha: { x: number; y: number }[]
  segmentation: { x: number; y: number }[][]
}

export const materialize: MaterializationStrategy<Data> = ({
  bbox_xywha: [xc, yc, width, height, angle],
  segmentation,
}) => ({
  ...rotatedViewport(xc, yc, width, height, angle),
  mask: { polygons: segmentation, featherPixels: 50 },
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
