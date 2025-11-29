import { fillPoint, strokeLineSegment } from "@finspotter/annotations/draw"
import { type AnnotationStrategy } from "@finspotter/annotations/react/BaseAnnotationLayer"
import { imageToClient } from "@finspotter/canvas/utils"
import { type SnapshotFrom } from "xstate"

import {
  machine,
  moveCornerMachine,
  moveSideMachine,
  newBoxMachine,
} from "./machine"

export const strategy: AnnotationStrategy<"bbox_xywh"> = {
  draw(canvas, state, style) {
    const { radius, lineWidth, color } = style
    const { shape } = state.context
    console.debug("drawing AnnotationLayer<bbox_xywh>")
    switch (true) {
      case state.matches({ active: { editing: "newBox" } }): {
        const {
          context: { shape, firstClick, mouse },
        } = state.children.newBox!.getSnapshot() as SnapshotFrom<
          typeof newBoxMachine
        >
        if (!shape.length || !firstClick) break
        fillPoint(canvas, firstClick, radius, color)
        mouse && fillPoint(canvas, mouse, radius, color)
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          strokeLineSegment(canvas, shape[i], shape[j], lineWidth, color)
        }
        break
      }
      case shape && state.matches({ active: { editing: "moveCorner" } }): {
        const {
          context: { shape },
        } = state.children.moveCorner!.getSnapshot() as SnapshotFrom<
          typeof moveCornerMachine
        >
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          fillPoint(canvas, shape[i], radius, color)
          strokeLineSegment(canvas, shape[i], shape[j], lineWidth, color)
        }
        break
      }
      case shape && state.matches({ active: { editing: "moveSide" } }): {
        const {
          context: { shape },
        } = state.children.moveSide!.getSnapshot() as SnapshotFrom<
          typeof moveSideMachine
        >
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          fillPoint(canvas, shape[i], radius, color)
          strokeLineSegment(canvas, shape[i], shape[j], lineWidth, color)
        }
        break
      }
      case shape && state.matches({ active: "editing" }): {
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          fillPoint(canvas, shape[i], radius, color)
          strokeLineSegment(canvas, shape[i], shape[j], lineWidth, color)
        }
        break
      }
      case !!shape: {
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          strokeLineSegment(canvas, shape[i], shape[j], lineWidth, color)
        }
      }
    }
  },
  machine,
  createInitialState(annotation) {
    const {
      data: [x, y, width, height] = [
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      ...rest
    } = annotation
    const allDefined = [x, y, width, height].every((v) => v !== undefined)
    return {
      ...(allDefined && { data: [x!, y!, width!, height!] }),
      ...rest,
      ...(allDefined && {
        shape: [
          { x: x!, y: y! + height! }, // bottom left
          { x: x!, y: y! }, // top left
          { x: x! + width!, y: y! }, // top right
          { x: x! + width!, y: y! + height! }, // bottom right
        ],
      }),
    }
  },
  getBoundingClientRect(shape, canvas, scale) {
    if (!canvas)
      return DOMRect.fromRect({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      })

    const tl =
      shape && imageToClient(shape[1].x * scale, shape[1].y * scale, canvas)
    const br =
      shape && imageToClient(shape[3].x * scale, shape[3].y * scale, canvas)
    return DOMRect.fromRect({
      x: tl?.x
        ? tl.x
        : (canvas?.getBoundingClientRect().x ?? 0) + (canvas?.offsetWidth ?? 0),
      y: tl?.y
        ? tl.y
        : (canvas?.getBoundingClientRect().y ?? 0) +
          (canvas?.offsetHeight ?? 0) / 2,
      width: br?.x && tl?.x ? br.x - tl.x : 0,
      height: br?.y && tl?.y ? br.y - tl.y : 0,
    })
  },
  handleSubscription(canvas, state) {
    const currentCursor = canvas.className.match(/cursor-[^\s]*/)?.[0]
    const { closestPoint, closestSegment } = state.context

    switch (true) {
      case state.matches({ active: { editing: "overPoint" } }) &&
        (closestPoint?.[0] === 0 || closestPoint?.[0] === 2): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-nesw-resize")
        break
      }
      case state.matches({ active: { editing: "moveSide" } }) &&
        (closestSegment?.[0] === 0 || closestSegment?.[0] === 2):
      case state.matches({ active: { editing: "overSegment" } }) &&
        (closestSegment?.[0] === 0 || closestSegment?.[0] === 2): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-ew-resize")
        break
      }
      case state.matches({ active: { editing: "overPoint" } }) &&
        (closestPoint?.[0] === 1 || closestPoint?.[0] === 3): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-nwse-resize")
        break
      }
      case state.matches({ active: { editing: "moveSide" } }) &&
        (closestSegment?.[0] === 1 || closestSegment?.[0] === 3):
      case state.matches({ active: { editing: "overSegment" } }) &&
        (closestSegment?.[0] === 1 || closestSegment?.[0] === 3): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-ns-resize")
        break
      }
      case state.matches({ active: { editing: "newBox" } }): {
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
  convert: {
    null: () => [],
  },
  getTransformMatrix([x, y, w, h]) {
    return { a: 1, b: 0, c: 0, d: 1, e: -x, f: -y, width: w, height: h }
  },
}
