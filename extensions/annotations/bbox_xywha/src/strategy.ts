import { rotatePoint } from "@finspotter/annotation-bbox_xywh/machine"
import { fillPoint, strokeLineSegment } from "@finspotter/annotations/draw"
import { type AnnotationStrategy } from "@finspotter/annotations/react/BaseAnnotationLayer"
import { imageToClient } from "@finspotter/canvas/utils"
import { SnapshotFrom } from "xstate"

import {
  machine,
  moveCornerMachine,
  moveSideMachine,
  newBoxMachine,
  rotateBoxMachine,
} from "./machine"

export const strategy: AnnotationStrategy<"bbox_xywha"> = {
  draw(canvas, state, style) {
    const { radius, lineWidth, color } = style
    const { shape } = state.context
    console.debug("drawing AnnotationLayer<bbox_xywha>")
    //TODO descriminate between editing machine and simpleMachine!
    switch (true) {
      case state.matches({ active: { editing: "newBox" } }): {
        const {
          context: { shape, clicks, mouse },
        } = state.children.newBox!.getSnapshot() as SnapshotFrom<
          typeof newBoxMachine
        >
        if (!clicks) break
        if (!shape.length) {
          //TODO: make these squares that rotate with mouse angle?
          fillPoint(canvas, clicks[0], radius, color)
          fillPoint(canvas, clicks[1] ?? mouse, radius, color)
          strokeLineSegment(
            canvas,
            clicks[0],
            clicks[1] ?? mouse,
            lineWidth,
            color,
            [3, 5]
          )
          break
        } else {
          for (let i = 0; i < shape.length; i++) {
            const j = (i + 1) % shape.length
            strokeLineSegment(
              canvas,
              shape[i],
              shape[j],
              lineWidth,
              color,
              i === 1 ? [3, 5] : []
            )
          }
          break
        }
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
          strokeLineSegment(
            canvas,
            shape[i],
            shape[j],
            lineWidth,
            color,
            i === 1 ? [3, 5] : []
          )
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
          strokeLineSegment(
            canvas,
            shape[i],
            shape[j],
            lineWidth,
            color,
            i === 1 ? [3, 5] : []
          )
        }
        break
      }
      case shape && state.matches({ active: { editing: "rotateBox" } }): {
        const {
          context: { shape },
        } = state.children.rotateBox!.getSnapshot() as SnapshotFrom<
          typeof rotateBoxMachine
        >
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          fillPoint(canvas, shape[i], radius, color)
          strokeLineSegment(
            canvas,
            shape[i],
            shape[j],
            lineWidth,
            color,
            i === 1 ? [3, 5] : []
          )
        }
        break
      }
      case shape && state.matches({ active: "editing" }): {
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          fillPoint(canvas, shape[i], radius, color)
          strokeLineSegment(
            canvas,
            shape[i],
            shape[j],
            lineWidth,
            color,
            i === 1 ? [3, 5] : []
          )
        }
        break
      }
      case !!shape: {
        for (let i = 0; i < shape.length; i++) {
          const j = (i + 1) % shape.length
          strokeLineSegment(
            canvas,
            shape[i],
            shape[j],
            lineWidth,
            color,
            i === 1 ? [3, 5] : []
          )
        }
      }
    }
  },
  machine,
  createInitialState(annotation) {
    const {
      data: [xc, yc, width, height, angle] = [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      ...rest
    } = annotation
    const allDefined = [xc, yc, width, height, angle].every(
      (v) => v !== undefined
    )
    return {
      ...(allDefined && { data: [xc!, yc!, width!, height!, angle!] }),
      ...rest,
      ...(allDefined && {
        shape: [
          [-width! / 2 + xc!, height! / 2 + yc!], // bottom left
          [-width! / 2 + xc!, -height! / 2 + yc!], // top left
          [width! / 2 + xc!, -height! / 2 + yc!], // top right
          [width! / 2 + xc!, height! / 2 + yc!], // bottom right
        ].map(([x, y]) => rotatePoint({ x, y }, { x: xc!, y: yc! }, angle!)),
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
    //TODO: specify this correctly for rotated box (max/min)
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
  //TODO: cursors during move
  handleSubscription(canvas, state) {
    const currentCursor = canvas.className.match(/cursor-[^\s]*/)?.[0]
    const { closestPoint, closestSegment } = state.context

    //TODO: these are just bbox cursors, can css cusors be rotated? otherwise need to know more or less which way line is pointing
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
      case state.matches({ active: { editing: "outsideBox" } }): {
        currentCursor && canvas.classList.remove(currentCursor)
        canvas.classList.add("cursor-grab")
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
    bbox_xywh: (data) => [
      data[0] + data[2] / 2,
      data[1] + data[3] / 2,
      data[2],
      data[3],
      0,
    ],
  },
  getTransformMatrix([xc, yc, w, h, angle]) {
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
