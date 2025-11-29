// https://stackoverflow.com/a/66653729/3473055
import {
  useEffect,
  useRef,
  type DependencyList,
  type EffectCallback,
} from "react"

type EqualityFn = (a: DependencyList, b: DependencyList) => boolean

export function useCustomEqualityEffect(
  cb: EffectCallback,
  deps: DependencyList,
  equal?: EqualityFn
) {
  const ref = useRef<DependencyList>(deps)

  if (!equal || !equal(deps, ref.current)) {
    ref.current = deps
  }

  useEffect(cb, [ref.current])
}
