import { createElement, type SVGProps } from "react"

export function ArrowsPointingOutIcon({
  ref: svgRef,
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string; titleId?: string }) {
  return createElement(
    "svg",
    Object.assign(
      {
        xmlns: "http://www.w3.org/2000/svg",
        stroke: "currentColor",
        strokeWidth: "1.5",
        fill: "none",
        viewBox: "0 0 24 24",
        "aria-hidden": "true",
        "data-slot": "icon",
        ref: svgRef,
        "aria-labelledby": titleId,
        strokeLinecap: "round",
        strokeLinejoin: "round",
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
      d: "m.333 12 3.182 3.182M.333 12l3.182-3.182M.333 12h7.424M12 23.667l-3.182-3.182M12 23.667l3.182-3.182M12 23.667v-7.424m0-15.91L8.818 3.515M12 .333l3.182 3.182M12 .333v7.424M23.667 12l-3.182 3.182M23.667 12l-3.182-3.182M23.667 12h-7.424",
    })
  )
}
