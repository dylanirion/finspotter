export type AffineTransform = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export type MaterializationPlan = {
  sourceToDerived: AffineTransform
  width: number
  height: number
  mask?: {
    polygons: number[][]
    featherPixels: number
  }
}

export type ImageCoordinateMapping = {
  sourceToDerived: AffineTransform
  derivedToSource: AffineTransform
  source: { width: number; height: number }
  derived: { width: number; height: number }
}

export type MaterializationStrategy<T> = (data: T) => MaterializationPlan

export function invertAffine(transform: AffineTransform): AffineTransform {
  const determinant =
    transform.a * transform.d - transform.b * transform.c
  if (determinant === 0) throw new Error("Materialization transform is singular")

  return {
    a: transform.d / determinant,
    b: -transform.b / determinant,
    c: -transform.c / determinant,
    d: transform.a / determinant,
    e:
      (transform.c * transform.f - transform.d * transform.e) /
      determinant,
    f:
      (transform.b * transform.e - transform.a * transform.f) /
      determinant,
  }
}

export function composeAffine(
  first: AffineTransform,
  second: AffineTransform
): AffineTransform {
  return {
    a: second.a * first.a + second.c * first.b,
    b: second.b * first.a + second.d * first.b,
    c: second.a * first.c + second.c * first.d,
    d: second.b * first.c + second.d * first.d,
    e: second.a * first.e + second.c * first.f + second.e,
    f: second.b * first.e + second.d * first.f + second.f,
  }
}

export function createCoordinateMapping(
  plan: MaterializationPlan,
  source: ImageCoordinateMapping["source"]
): ImageCoordinateMapping {
  return {
    sourceToDerived: plan.sourceToDerived,
    derivedToSource: invertAffine(plan.sourceToDerived),
    source,
    derived: { width: plan.width, height: plan.height },
  }
}

export function rotatedViewport(
  xc: number,
  yc: number,
  width: number,
  height: number,
  angleDegrees: number
): MaterializationPlan {
  const angle = angleDegrees * (Math.PI / 180)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  return {
    sourceToDerived: {
      a: cos,
      b: sin,
      c: -sin,
      d: cos,
      e: -xc * cos + yc * sin + width / 2,
      f: -xc * sin - yc * cos + height / 2,
    },
    width,
    height,
  }
}

export function polygonViewport(polygons: number[][]): MaterializationPlan {
  const points = polygons.flatMap((polygon) => {
    const pairs: [number, number][] = []
    for (let index = 0; index < polygon.length; index += 2) {
      const x = polygon[index]
      const y = polygon[index + 1]
      if (x !== undefined && y !== undefined) pairs.push([x, y])
    }
    return pairs
  })
  if (points.length === 0) throw new Error("Materialization mask is empty")

  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)

  return {
    sourceToDerived: { a: 1, b: 0, c: 0, d: 1, e: -left, f: -top },
    width: Math.max(1, Math.ceil(right - left)),
    height: Math.max(1, Math.ceil(bottom - top)),
    mask: { polygons, featherPixels: 50 },
  }
}
