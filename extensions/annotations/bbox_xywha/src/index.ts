import {
	rotatedViewport,
	type MaterializationStrategy,
} from "@finspotter/annotations/materialization"

export const name = "bbox_xywha"
export const pkg = "@finspotter/annotation-bbox_xywha"
export const dataType = "[number, number, number, number, number]"
export const displayType = "{ x: number; y: number }[]"

export const materialize: MaterializationStrategy<
	[number, number, number, number, number]
> = ([xc, yc, width, height, angle]) =>
	rotatedViewport(xc, yc, width, height, angle)
