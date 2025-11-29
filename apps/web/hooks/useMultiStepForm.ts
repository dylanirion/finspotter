import { useCallback, useState, type ReactElement } from "react"

export function useMultiStepForm(steps: ReactElement<{ title?: string }>[]) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const prev = () => {
    setCurrentStepIndex((index) => (index <= 0 ? index : index - 1))
  }

  const next = () => {
    setCurrentStepIndex((index) =>
      index >= steps.length - 1 ? index : index + 1
    )
  }

  const goTo = useCallback((index: number) => {
    setCurrentStepIndex(index)
  }, [])

  return {
    currentStepIndex,
    step: steps[currentStepIndex],
    steps,
    prev,
    next,
    goTo,
  }
}
