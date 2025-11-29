import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "components/ui/tooltip/Tooltip"

const cnnExplainerText = `A CNN enables software to understand pictures. Similar to a brain, a CNN is made up of interconnected layers of neurons that are activated by distinct patterns and features. An initial training phase involving 1000s of images enables the network to learn the different patterns unique to each species.`

export function DetectionStep() {
  return (
    <div className="relative">
      <h2 className="text-lg leading-8 font-semibold tracking-tight text-indigo-600">
        Detection
      </h2>
      <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Let&apos;s find the shark!
      </p>
      <div className="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
        We first identify the species of shark in your image by running it
        through a{" "}
        <Tooltip>
          <TooltipTrigger className="text-indigo-600">
            Convolutional Neural Network (CNN)
          </TooltipTrigger>
          <TooltipContent className="max-w-96 rounded-md bg-black p-4 text-center text-white">
            {cnnExplainerText}
          </TooltipContent>
        </Tooltip>{" "}
        trained on 1000s of images of shysharks.
      </div>
      <blockquote className="mt-10 hidden border-l-4 border-gray-300 bg-gray-50 p-4 leading-8 sm:block dark:bg-slate-700">
        <p className="text-sm">
          D. Bolya, C. Zhou, F. Xiao and Y. J. Lee,
          <Link
            className="text-indigo-600"
            href="https://ieeexplore.ieee.org/document/9010373"
          >
            YOLACT: Real-Time Instance Segmentation
          </Link>
          , 2019 IEEE/CVF International Conference on Computer Vision (ICCV),
          Seoul, Korea (South), 2019, pp. 9156-9165,{" "}
          <span className="inline-block">doi: 10.1109/ICCV.2019.00925.</span>
        </p>
      </blockquote>
    </div>
  )
}
