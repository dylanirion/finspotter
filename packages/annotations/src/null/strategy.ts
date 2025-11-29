import { type AnnotationStrategy } from "@finspotter/annotations/react/BaseAnnotationLayer"

import { machine } from "./machine"

export const strategy: AnnotationStrategy<"null"> = {
  draw(_canvas, _state, _style) {},
  machine,
  createInitialState(annotation) {
    return annotation
  },
  getBoundingClientRect(shape, canvas, _scale) {
    const { x, y } = canvas?.getBoundingClientRect() ?? {
      x: undefined,
      y: undefined,
    }
    return DOMRect.fromRect({
      x: (x ?? 0) + (canvas?.offsetWidth ?? 0),
      y: (y ?? 0) + (canvas?.offsetHeight ?? 0) / 2,
      width: 0,
      height: 0,
    })
  },
  handleSubscription(canvas, state) {
    console.debug("editService state:", {
      state: state.value,
      ...state.context,
    })
  },
  getTransformMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  },
}
