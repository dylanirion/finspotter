import type { MaterializationStrategy } from "@finspotter/annotations/materialization"

export const name = "bbox_xywh"
export const pkg = "@finspotter/annotation-bbox_xywh"
export const dataType = "[number, number, number, number]"
export const displayType = "{ x: number; y: number }[]"

export const materialize: MaterializationStrategy<
	[number, number, number, number]
> = ([x, y, width, height]) => ({
	sourceToDerived: { a: 1, b: 0, c: 0, d: 1, e: -x, f: -y },
	width,
	height,
})
