import { memo } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "components/ui/tooltip/Tooltip"

import { DemoImage } from "./DemoImage"

const shySharkExplainerText = `Shysharks, or catsharks, are egg-laying sharks of the family Scyliorhinidae. These make up the largest family of sharks in the world with around 160 species found across the oceans!`

const demoSpecies = [
  {
    name: "Puffadder shyshark",
    src: "https://static.caperadd.com/wb/2/3/234df40c-745e-4fcb-a13a-d43ec7a6e95c/GOPR1218.JPG",
  },
  {
    name: "Dark shyshark",
    src: "https://static.caperadd.com/wb/c/2/c2e20d48-baa8-4bb8-8902-9e0448f0a1bb/GOPR1437.JPG",
  },
  {
    name: "Leopard catshark",
    src: "https://static.caperadd.com/wb/a/0/a0c3acb1-85a5-4f21-9dad-9d0a4751e154%2FGOPR2562.JPG",
  },
  {
    name: "Pyjama catshark",
    src: "https://static.caperadd.com/wb/8/7/87929471-5a22-4d34-a5ff-c0e5bdcb3285/GOPR1432.JPG",
  },
]

export const DemoGrid = memo(function DemoGrid() {
  return (
    <div className="mt-5 flex flex-wrap place-content-center gap-5">
      {demoSpecies.map((item) => (
        <DemoImage key={item.name} src={item.src} name={item.name} />
      ))}
    </div>
  )
})
DemoGrid.displayName = "DemoGrid"

export function SelectImageStep() {
  return (
    <div className="relative">
      <h2 className="text-lg leading-8 font-semibold tracking-tight text-indigo-600">
        Behind the scenes
      </h2>
      <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        How does it work?
      </p>
      <div className="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
        Drag an image of a{" "}
        <Tooltip>
          <TooltipTrigger className="text-indigo-600">shyshark</TooltipTrigger>
          <TooltipContent className="max-w-96 rounded-md bg-black p-4 text-center text-white">
            {shySharkExplainerText}
          </TooltipContent>
        </Tooltip>{" "}
        onto the dropzone{" "}
        <span className={"hidden lg:inline-block"}>to the right</span>
        <span className={"inline-block lg:hidden"}>below</span>. Don&apos;t have
        one? Use one of ours below!
      </div>
      <DemoGrid />
    </div>
  )
}
