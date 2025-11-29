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
      d: "M 4.7076006,16.712912 10.231972,20.689021 20.757556,15.596404 19.2924,7.2870885 13.768028,3.3109793 12.267831,10.941579 6.5838938,10.088988 Z",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      fill: "currentColor",
    })
  )
})
Icon.displayName = "SegmentationIcon"
