import { createElement, forwardRef, type SVGProps } from "react"

export const Icon = forwardRef<
  SVGSVGElement,
  SVGProps<SVGSVGElement> & { title?: string; titleId?: string }
>(({ title, titleId, ...props }, svgRef) => {
  return createElement(
    "svg",
    Object.assign(
      {
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        viewBox: "0 0 24 24",
        "aria-hidden": "true",
        "data-slot": "icon",
        ref: svgRef,
        "aria-labelledby": titleId,
      },
      props
    ),
    title
      ? createElement(
          "title",
          {
            id: titleId,
          },
          title
        )
      : null,
    createElement("path", {
      d: "m 5.25,20 a 1.5,1.5 0 0 1 -1.5,1.5 1.5,1.5 0 0 1 -1.5,-1.5 1.5,1.5 0 0 1 1.5,-1.5 1.5,1.5 0 0 1 1.5,1.5 z m 16.5,0 a 1.5,1.5 0 0 1 -1.5,1.5 1.5,1.5 0 0 1 -1.5,-1.5 1.5,1.5 0 0 1 1.5,-1.5 1.5,1.5 0 0 1 1.5,1.5 z m 0,-16 A 1.5,1.5 0 0 1 20.25,5.5 1.5,1.5 0 0 1 18.75,4 1.5,1.5 0 0 1 20.25,2.5 1.5,1.5 0 0 1 21.75,4 Z M 5.25,4 A 1.5,1.5 0 0 1 3.75,5.5 1.5,1.5 0 0 1 2.25,4 1.5,1.5 0 0 1 3.75,2.5 1.5,1.5 0 0 1 5.25,4 Z M 3.75,5.5 v 13 M 5.25,20 h 13.5 m 1.5,-1.5 V 5.5 M 18.75,4 H 5.25",
    })
  )
})
Icon.displayName = "Bbox_XYWHIcon"
