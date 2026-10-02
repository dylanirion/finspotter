import {
	polygonViewport,
	type MaterializationStrategy,
} from "@finspotter/annotations/materialization"

export const name = "segmentation"
export const pkg = "@finspotter/annotation-segmentation"
export const dataType = "number[][]"
export const displayType = "{ x: number; y: number }[][]"

export const materialize: MaterializationStrategy<number[][]> = (polygons) =>
	polygonViewport(polygons)
