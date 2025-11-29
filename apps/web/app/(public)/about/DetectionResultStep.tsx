import { species, type Species } from "@finspotter/config/species"
import { useQuery } from "@tanstack/react-query"
import { getDetections } from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import parse from "html-react-parser"
import { countObjectToSentence } from "lib/utils"

import { useDemo } from "./About"

export function DetectionResultStep() {
  const { submissionId } = useDemo()
  const { data: detections } = useQuery({
    queryKey: [submissionId, "detections"],
    queryFn: () => getDetections({ pk: submissionId }),
    initialData: [],
  })
  if (!detections.length) return
  return (
    <>
      <h2 className="text-lg leading-8 font-semibold tracking-tight text-indigo-600">
        Detection
      </h2>
      <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        We found something!
      </p>
      <div className="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
        We&apos;re pretty sure this image contains{" "}
        {parse(
          countObjectToSentence(
            detections.reduce(
              (acc, detection) => {
                acc[species[detection?.category as Species].commonName] =
                  (acc[species[detection?.category as Species].commonName] ||
                    0) + 1
                return acc
              },
              {} as Record<string, number>
            )
          )
        )}
        &nbsp;
        <span>
          Next, we&apos;ll try to match this shark against our database.
        </span>
      </div>
      <div className="mt-10 mb-2 ml-2 text-base leading-7 text-gray-600">
        <Button className="cursor-pointer" intent="primary">
          Match it!
        </Button>
      </div>
    </>
  )
}
