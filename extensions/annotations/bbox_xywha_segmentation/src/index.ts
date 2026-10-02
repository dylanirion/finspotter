import {
	rotatedViewport,
	type MaterializationStrategy,
} from "@finspotter/annotations/materialization"

export const name = "bbox_xywha$segmentation"
export const pkg = "@finspotter/annotation-bbox_xywha_segmentation"
export const dataType = `{ "bbox_xywha": [number, number, number, number, number]; "segmentation": number[][] }`
export const displayType = `{ "bbox_xywha": { x: number; y: number }[]; "segmentation": { x: number; y: number }[][] }`

type Data = {
	bbox_xywha: [number, number, number, number, number]
	segmentation: number[][]
}

export const materialize: MaterializationStrategy<Data> = ({
	bbox_xywha: [xc, yc, width, height, angle],
	segmentation,
}) => ({
	...rotatedViewport(xc, yc, width, height, angle),
	mask: { polygons: segmentation, featherPixels: 50 },
})
