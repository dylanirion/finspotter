"use client"

import { useCallback } from "react"
import { doSubmission } from "app/_actions/submit"
import { Button } from "components/ui/inputs/Button"
import { Spinner } from "components/ui/spinners/Spinner"
import { useMultiStepForm } from "hooks/useMultiStepForm"
import { cn } from "lib/utils"
import { useFormStatus } from "react-dom"
import toast from "react-hot-toast"

import { AddMetadataStep } from "./AddMetadataStep"
import { AddUserDataStep } from "./AddUserDataStep"
import { ChoosePhotosStep } from "./ChoosePhotosStep"
import { useSubmission } from "./EncounterSubmissionContext"
import { ThankYou } from "./ThankYou"

export function EncounterSubmissionForm() {
  const { submissionId, data, canSubmit, uploadedFileList } = useSubmission()
  const { currentStepIndex, step, steps, next, goTo } = useMultiStepForm([
    <AddMetadataStep key={0} title="Image Details" />,
    <AddUserDataStep key={1} title="Contact Details" />,
    //TODO: if no default detection function, show manual annotation step
    <ThankYou key={2} title="Thank You!" />,
  ])
  const numSteps = steps.length

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      try {
        return doSubmission({
          //TODO: include captcha token? presumably we've passed one check already
          submissionId,
          encounters: data.map((encounter) => {
            const { file, xhr, presignedUrl, ...rest } = encounter
            if (!uploadedFileList.current.has(encounter.id))
              throw new Error(`${encounter.id} has not finished uploading`)

            return {
              ...rest,
              src: uploadedFileList.current.get(encounter.id)!,
            }
          }),
          formData,
        }).then(() => next())
      } catch (error) {
        console.debug(error)
        toast.error("Something went wrong, please try again.")
      }
    },
    [submissionId, data, uploadedFileList, next]
  )

  if (data.length === 0) return <ChoosePhotosStep key={0} />

  return currentStepIndex + 1 !== numSteps ? (
    <form action={handleSubmit}>
      <ol className="flex w-full items-center px-4 text-center text-sm font-medium text-gray-500 sm:text-base dark:text-gray-400">
        {steps.slice(0, -1).map((tab, i) => {
          return (
            // TODO: style completed steps, use icons for small screens (with check icon??)
            <li
              key={i}
              className={
                // TODO: disable future steps until all required information is entered
                cn(
                  "flex w-full items-center after:mx-6 after:inline-block after:h-1 after:w-full after:border-4 after:border-b after:content-[''] xl:after:mx-10",
                  {
                    "text-blue-600 after:border-blue-600 xl:after:mx-10":
                      currentStepIndex == i,
                    "cursor-pointer after:border-gray-100 dark:after:border-gray-500":
                      currentStepIndex !== i,
                  }
                )
              }
              onClick={() => goTo(i)}
            >
              <span className="flex items-center after:mx-2 after:font-light after:text-gray-200 after:content-[''] sm:after:hidden dark:after:text-gray-500">
                {/*<svg aria-hidden="true" class="w-4 h-4 mr-2 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>*/}
                <span className="mr-2">{i + 1}</span>
                {tab.props.title ?? "Step Details"}
              </span>
            </li>
          )
        })}
        {currentStepIndex + 1 === numSteps - 1 ? (
          <SubmitButton canSubmit={canSubmit} />
        ) : (
          <Button
            intent="primary"
            size="medium"
            className="flex w-48 cursor-pointer items-center justify-center"
            onClick={(e) => {
              e.preventDefault()
              next()
            }}
          >
            Next
          </Button>
        )}
      </ol>
      <div>{step}</div>
    </form>
  ) : (
    <div>{step}</div>
  )
}

function SubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending: isPending } = useFormStatus()

  return (
    <Button
      intent="primary"
      type="submit"
      size="medium"
      className="flex w-48 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:bg-gray-500 disabled:text-white disabled:hover:bg-gray-500"
      disabled={!canSubmit || isPending}
    >
      {isPending ? (
        <Spinner className="size-5 animate-spin text-indigo-400" />
      ) : (
        "Submit"
      )}
    </Button>
  )
}
