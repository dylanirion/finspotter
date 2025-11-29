import { setup } from "xstate"

import { type AnnotationType } from "."
import { type DisplayAnnotation } from "./react/BaseAnnotationLayer"

export function createSimpleMachine<T extends AnnotationType | "null">() {
  return setup({
    types: {
      context: {} as DisplayAnnotation<T>,
      input: {} as DisplayAnnotation<T>,
    },
  }).createMachine({
    context: ({ input }) => ({
      ...input,
    }),
  })
}
