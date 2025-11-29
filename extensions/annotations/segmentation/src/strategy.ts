import { fillPoint, strokeLineSegment } from "@finspotter/annotations/draw"
import { type AnnotationStrategy } from "@finspotter/annotations/react/BaseAnnotationLayer"
import { SnapshotFrom } from "xstate"

import { machine, movePointMachine } from "./machine"

export const strategy: AnnotationStrategy<"segmentation"> = {
  draw(canvas, state, style) {
    const { radius, lineWidth, color } = style
    const { shape } = state.context
    console.debug("drawing AnnotationLayer<segmentation>")
    switch (true) {
      case shape && state.matches({ active: { editing: "movePoint" } }): {
        const {
          context: { shape },
        } = state.children.movePoint!.getSnapshot() as SnapshotFrom<
          typeof movePointMachine
        >
        for (let i = 0; i < shape.length; i++) {
          for (let j = 0; j < shape[i].length; j++) {
            const k = (j + 1) % shape[i].length
            fillPoint(canvas, shape[i][j], radius, color)
            strokeLineSegment(
              canvas,
              shape[i][j],
              shape[i][k],
              lineWidth,
              color
            )
          }
        }
        break
      }
      case shape && state.matches({ active: "editing" }): {
        for (let i = 0; i < shape.length; i++) {
          for (let j = 0; j < shape[i].length; j++) {
            const k = (j + 1) % shape[i].length
            fillPoint(canvas, shape[i][j], radius, color)
            strokeLineSegment(
              canvas,
              shape[i][j],
              shape[i][k],
              lineWidth,
              color
            )
          }
        }
        break
      }
      case !!shape: {
        for (let i = 0; i < shape.length; i++) {
          for (let j = 0; j < shape[i].length; j++) {
            const k = (j + 1) % shape[i].length
            strokeLineSegment(
              canvas,
              shape[i][j],
              shape[i][k],
              lineWidth,
              color
            )
          }
        }
      }
    }
  },
  machine,
  createInitialState(annotation) {
    const { data, ...rest } = annotation
    return {
      data,
      ...rest,
      shape: data?.map((part) => {
        const arr: { x: number; y: number }[] = []
        for (let j = 0; j < part.length - 1; j += 2) {
          arr.push({ x: part[j], y: part[j + 1] })
        }
        return arr
      }),
    }
  },
  //TODO: calculate bbox of segmentation
  getBoundingClientRect(data, canvas, scale) {
    //if (!canvas)
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
    /*
    const [_bl, _tl, tr, _br] = data
    const { x, y } = canvasToClient(tr.x, tr.y, canvas)

    return {
      width: 0,
      height: 0,
      top: y * scale,
      right: x * scale,
      bottom: y * scale,
      left: x * scale,
    } as DOMRect
  */
  },
  //TODO: cursors during move
  handleSubscription(canvas, state) {
    const currentCursor = canvas.className.match(/cursor-[^\s]*/)?.[0]
    const { closestPoint } = state.context

    switch (true) {
      case state.matches({ active: { editing: "overPoint" } }): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-grab")
        break
      }
      case state.matches({ active: { editing: "newSeg" } }): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-crosshair")
        break
      }
      case state.matches("active"): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-defaut")
        break
      }
    }
  },
}
