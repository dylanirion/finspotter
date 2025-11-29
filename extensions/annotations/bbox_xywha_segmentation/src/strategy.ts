import { strategy as XYWHA } from "@finspotter/annotation-bbox_xywha/strategy"
import { strategy as Segmentation } from "@finspotter/annotation-segmentation/strategy"
import { type AnnotationStrategy } from "@finspotter/annotations/react/BaseAnnotationLayer"

import { machine } from "./machine"

export const strategy: AnnotationStrategy<"bbox_xywha$segmentation"> = {
  draw(canvas, state, style) {
    const {
      shape: { bbox_xywha, segmentation } = {
        bbox_xywha: undefined,
        segmentation: undefined,
      },
    } = state.context
    /* bbox_xywha &&
      XYWHA.draw(
        canvas,
        {
          ...state,
          context: {
            id: state.context.id,
            mediaId: state.context.mediaId,
            data: state.context.data?.bbox_xywha,
            closestPoint: undefined,
            closestSegment: undefined,
            shape: bbox_xywha,
            type: "bbox_xywha",
          },
        },
        style
      ) */
  },
  machine,
  createInitialState(annotation) {
    const {
      data: { bbox_xywha, segmentation } = {
        bbox_xywha: undefined,
        segmentation: undefined,
      },
      ...rest
    } = annotation
    return {
      ...(bbox_xywha && segmentation && { data: { bbox_xywha, segmentation } }),
      ...rest,
      ...(bbox_xywha &&
        segmentation && {
          shape: {
            bbox_xywha: XYWHA.createInitialState({
              data: bbox_xywha,
              ...rest,
              type: "bbox_xywha",
            }).shape!,
            segmentation: Segmentation.createInitialState({
              data: segmentation,
              ...rest,
              type: "segmentation",
            }).shape!,
          },
        }),
      ...rest,
    }
  },
  getBoundingClientRect(data, canvas, scale) {
    return XYWHA.getBoundingClientRect(data?.bbox_xywha, canvas, scale)
  },
  handleSubscription(canvas, state) {
    const currentCursor = canvas.className.match(/cursor-[^\s]*/)?.[0]
  },
  getTransformMatrix({ bbox_xywha: [xc, yc, w, h, angle] }) {
    const cos = Math.cos(angle * (Math.PI / 180))
    const sin = Math.sin(angle * (Math.PI / 180))

    const tx = w / 2
    const ty = h / 2

    const a = cos
    const b = sin
    const c = -sin
    const d = cos

    const e = -xc * cos + yc * sin + tx
    const f = -xc * sin - yc * cos + ty

    return { a, b, c, d, e, f, width: w, height: h }
  },
}
