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
      d: "m 21.050587,17.258267 a 1.5,1.5 0 0 1 1.737684,1.21674 1.5,1.5 0 0 1 -1.21674,1.737683 1.5,1.5 0 0 1 -1.737683,-1.216739 1.5,1.5 0 0 1 1.216739,-1.737684 z M 18.185393,1.0089389 a 1.5,1.5 0 0 1 1.737684,1.2167398 1.5,1.5 0 0 1 -1.21674,1.7376837 1.5,1.5 0 0 1 -1.737684,-1.2167397 1.5,1.5 0 0 1 1.21674,-1.7376838 z M 2.4284686,3.7873097 A 1.5,1.5 0 0 1 4.1661523,5.0040492 1.5,1.5 0 0 1 2.949413,6.741733 1.5,1.5 0 0 1 1.2117292,5.5249935 1.5,1.5 0 0 1 2.4284686,3.7873097 Z M 5.2936632,20.036638 A 1.5,1.5 0 0 1 7.031347,21.253377 1.5,1.5 0 0 1 5.8146075,22.991061 1.5,1.5 0 0 1 4.0769236,21.774322 1.5,1.5 0 0 1 5.2936632,20.036638 Z M 7.031347,21.253377 19.833848,18.995951 M 21.050587,17.258267 18.706337,3.9633624 M 16.968653,2.7466227 4.1661523,5.0040492 M 2.949413,6.741733 5.2936632,20.036638",
    })
  )
})
Icon.displayName = "Bbox_XYWHAIcon"
