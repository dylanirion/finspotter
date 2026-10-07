"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { composeAffine } from "@finspotter/annotations/materialization"
import { getAnnotationComponents } from "@finspotter/annotations/react"
import { Canvas, type Transform } from "@finspotter/canvas"
import { MediaLayer } from "@finspotter/canvas/media"
import { PanZoomPanel, type PanZoomService } from "@finspotter/canvas/pan-zoom"
import { type Annotation } from "@finspotter/core/annotation"
import { type Media } from "@finspotter/core/media"
import { ArrowPathIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { getSingleAnnotation } from "app/_actions/annotations"
import {
  getReviewComparisonArtifacts,
  type ReviewComparisonData,
} from "app/_actions/pipeline"
import { Button } from "components/ui/inputs/Button"
import { cn } from "lib/utils"

import { MediaGroup } from "./MediaGroup"

//TODO: smart select orientation, i.e. top-up, top-right
//TODO: will depend on w>h, etc, and whether both can be rotated
//TODO: MediaGroup probably also need to know this
//TODO: mirror button, negate a or d
//TODO: z index from layer ordering?
//TODO: hide match pairs not in view
//TODO: clear MediaLayers on render
//TODO: rotate canvas, pick side by side top or bottom

type CompareProps =
  | { ids: [string, string]; comparison?: never }
  | { ids?: never; comparison: ReviewComparisonData; reviewId: string }

type QuarterTurn = 0 | 1 | 2 | 3

export function ReviewCompare({
  comparison,
  reviewId,
}: {
  comparison: ReviewComparisonData
  reviewId: string
}) {
  return <Compare comparison={comparison} reviewId={reviewId} />
}

export function Compare({ ids, comparison, reviewId }: CompareProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>()
  const [canvasA, setCanvasA] = useState<HTMLCanvasElement | null>()
  const [canvasB, setCanvasB] = useState<HTMLCanvasElement | null>()
  const [mediaA, setMediaA] = useState<{
    matrix: DOMMatrix
    derivedMatrix: DOMMatrix
  } | null>()
  const [mediaB, setMediaB] = useState<{
    matrix: DOMMatrix
    derivedMatrix: DOMMatrix
  } | null>()
  const [panZoomA, setPanZoomA] = useState<{ service: PanZoomService } | null>()
  const [panZoomB, setPanZoomB] = useState<{ service: PanZoomService } | null>()
  const [rotationA, setRotationA] = useState<QuarterTurn>(0)
  const [rotationB, setRotationB] = useState<QuarterTurn>(0)
  const [mediaLoaded, setMediaLoaded] = useState<[boolean, boolean]>([
    false,
    false,
  ])
  const [mediaFailed, setMediaFailed] = useState(false)
  const handleMediaLoaded = useCallback((index: 0 | 1) => {
    setMediaLoaded((loaded) => {
      if (loaded[index]) return loaded
      const next: [boolean, boolean] = [...loaded]
      next[index] = true
      return next
    })
  }, [])
  const handleMediaALoaded = useCallback(
    () => handleMediaLoaded(0),
    [handleMediaLoaded]
  )
  const handleMediaBLoaded = useCallback(
    () => handleMediaLoaded(1),
    [handleMediaLoaded]
  )
  const handleMediaError = useCallback(() => setMediaFailed(true), [])

  const { data: persistedA, isFetching: isFetchingA } = useQuery({
    queryKey: ["annotation", String(ids?.[0])],
    queryFn: (): Promise<
      | (Annotation & {
          media?: Pick<Media, "id" | "src" | "exif">
        })
      | null
    > => getSingleAnnotation(ids![0]),
    enabled: ids !== undefined,
  })
  const { data: persistedB, isFetching: isFetchingB } = useQuery({
    queryKey: ["annotation", String(ids?.[1])],
    queryFn: (): Promise<
      | (Annotation & {
          media?: Pick<Media, "id" | "src" | "exif">
        })
      | null
    > => getSingleAnnotation(ids![1]),
    enabled: ids !== undefined,
  })
  const { data: artifacts } = useQuery({
    queryKey: ["review-comparison-artifacts", reviewId],
    queryFn: () => getReviewComparisonArtifacts(reviewId!),
    enabled:
      reviewId !== undefined &&
      mediaLoaded[0] &&
      mediaLoaded[1] &&
      !mediaFailed,
  })
  const a = comparison
    ? { ...comparison.query.annotation, media: comparison.query.media }
    : persistedA
  const b = comparison
    ? {
        ...comparison.reference.annotation,
        media: comparison.reference.media,
      }
    : persistedB
  const isFetching = ids !== undefined && (isFetchingA || isFetchingB)
  const labels: [string, string] = ids ?? [
    `${comparison.query.annotation.mediaId}/${comparison.query.annotation.detectionId}`,
    `${comparison.reference.annotation.mediaId}/${comparison.reference.annotation.detectionId}`,
  ]
  const comparisonFeaturesA = artifacts?.queryFeatures ?? []
  const comparisonFeaturesB = artifacts?.referenceFeatures ?? []
  const comparisonMatches = artifacts?.matches ?? []

  if (!a && !b && !isFetching) return <h1>Not Found!</h1>
  //TODO: a loading skeleton would be ideal, but media might shift

  const { getTransformMatrix: transformA } = getAnnotationComponents(
    a?.type ?? "null"
  )
  const { getTransformMatrix: transformB } = getAnnotationComponents(
    b?.type ?? "null"
  )

  const transformMatA = transformA(a?.data ?? null)
  const transformMatB = transformB(b?.data ?? null)
  const viewportA = rotateViewport(transformMatA, a?.media, rotationA)
  const viewportB = rotateViewport(transformMatB, b?.media, rotationB)
  const layout =
    isLandscape(viewportA.transform) || isLandscape(viewportB.transform)
      ? "vertical"
      : "horizontal"
  const rotateAClockwise = useCallback(
    () => setRotationA((turn) => ((turn + 1) % 4) as QuarterTurn),
    []
  )
  const rotateBClockwise = useCallback(
    () => setRotationB((turn) => ((turn + 1) % 4) as QuarterTurn),
    []
  )

  return (
    a?.media &&
    b?.media && (
      <>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="inline">Compare</span>{" "}
          <span className="inline text-indigo-600">{labels[0]}</span>{" "}
          <span className="inline">:</span>{" "}
          <span className="inline text-indigo-600">{labels[1]}</span>
        </h1>
        <div ref={setContainer} className="relative">
          <MediaGroup className="justify-center" layout={layout}>
            <Canvas
              id={a.media.id}
              ref={setCanvasA}
              className={cn("rounded-md shadow-md", {
                "h-[calc(100dvh_-_10rem)]":
                  viewportA.transform.height > viewportA.transform.width,
              })}
              width={viewportA.transform.width}
              height={viewportA.transform.height}
            >
              <MediaLayer
                ref={setMediaA}
                media={a.media}
                transform={viewportA.transform}
                derivedTransform={viewportA.derivedTransform}
                onLoad={handleMediaALoaded}
                onError={handleMediaError}
              >
                <PanZoomPanel
                  ref={setPanZoomA}
                  className="absolute top-1 left-1"
                />
              </MediaLayer>
              <Button
                intent="none"
                size="icon"
                className="absolute top-1 right-1 z-[60] grid size-8 place-items-center rounded-md bg-slate-950/80 text-white shadow hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                onClick={rotateAClockwise}
                title="Rotate query image clockwise"
                aria-label="Rotate query image clockwise"
              >
                <ArrowPathIcon className="size-4" />
              </Button>
            </Canvas>
            <Canvas
              id={b.media.id}
              ref={setCanvasB}
              className={cn("rounded-md shadow-md", {
                "h-[calc(100dvh_-_10rem)]":
                  viewportB.transform.height > viewportB.transform.width,
              })}
              width={viewportB.transform.width}
              height={viewportB.transform.height}
            >
              <MediaLayer
                ref={setMediaB}
                media={b.media}
                transform={viewportB.transform}
                derivedTransform={viewportB.derivedTransform}
                onLoad={handleMediaBLoaded}
                onError={handleMediaError}
              >
                <PanZoomPanel
                  ref={setPanZoomB}
                  className="absolute top-1 left-1"
                />
              </MediaLayer>
              <Button
                intent="none"
                size="icon"
                className="absolute top-1 right-1 z-[60] grid size-8 place-items-center rounded-md bg-slate-950/80 text-white shadow hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                onClick={rotateBClockwise}
                title="Rotate reference image clockwise"
                aria-label="Rotate reference image clockwise"
              >
                <ArrowPathIcon className="size-4" />
              </Button>
            </Canvas>
          </MediaGroup>
          {container && canvasA && canvasB && (
            <FeatureConnector
              featuresA={comparisonFeaturesA}
              featuresB={comparisonFeaturesB}
              matches={comparisonMatches}
              container={container}
              canvasA={canvasA}
              canvasB={canvasB}
              transformA={mediaA?.derivedMatrix}
              transformB={mediaB?.derivedMatrix}
              panZoomA={panZoomA?.service}
              panZoomB={panZoomB?.service}
            />
          )}
        </div>
      </>
    )
  )
}

export function FeatureConnector({
  featuresA,
  featuresB,
  matches,
  container,
  canvasA,
  canvasB,
  transformA,
  transformB,
  panZoomA,
  panZoomB,
}: {
  featuresA: [number, number][]
  featuresB: [number, number][]
  matches: { from: number; to: number; distance: number }[] // [indexA, indexB, distance]
  container: HTMLDivElement
  canvasA: HTMLCanvasElement
  canvasB: HTMLCanvasElement
  transformA?: DOMMatrix
  transformB?: DOMMatrix
  panZoomA?: PanZoomService
  panZoomB?: PanZoomService
}) {
  const [render, reRender] = useReducer((prev) => prev + 1, 0)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!panZoomA || !panZoomB) return
    const subscriptionA = panZoomA.subscribe(reRender)
    const subscriptionB = panZoomB.subscribe(reRender)
    return () => {
      subscriptionA.unsubscribe()
      subscriptionB.unsubscribe()
    }
  }, [panZoomA, panZoomB])

  useEffect(() => {
    const ctx = overlayRef.current?.getContext("2d")
    const ctxA = canvasA.getContext("2d")
    const ctxB = canvasB.getContext("2d")
    if (!ctx || !ctxA || !ctxB || !transformA || !transformB) return

    const containerRect = container.getBoundingClientRect()
    const canvasRectA = canvasA.getBoundingClientRect()
    const canvasRectB = canvasB.getBoundingClientRect()

    const panZoomTransformA = ctxA.getTransform()
    const panZoomTransformB = ctxB.getTransform()

    const finalTransformA = panZoomTransformA.multiply(transformA)
    const finalTransformB = panZoomTransformB.multiply(transformB)

    ctx.globalAlpha = 0.5
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    for (const { from, to, distance } of matches) {
      const featureA = featuresA[from]
      const featureB = featuresB[to]
      if (featureA === undefined || featureB === undefined) continue

      const viewportA = transformPoint(featureA, finalTransformA)
      const viewportB = transformPoint(featureB, finalTransformB)
      if (
        !isWithinViewport(viewportA, canvasA) ||
        !isWithinViewport(viewportB, canvasB)
      )
        continue

      const screenA = toOverlay(
        viewportA,
        canvasA,
        canvasRectA,
        containerRect
      )
      const screenB = toOverlay(
        viewportB,
        canvasB,
        canvasRectB,
        containerRect
      )
      ctx.beginPath()
      ctx.lineWidth = 5
      ctx.strokeStyle = "blue"
      ctx.moveTo(...screenA)
      ctx.lineTo(...screenB)
      ctx.stroke()
    }
  }, [
    container,
    canvasA,
    canvasB,
    featuresA,
    featuresB,
    matches,
    transformA,
    transformB,
    render,
  ])

  //Watch out for:
  //DOM changes or resize	- Use a ResizeObserver or requestAnimationFrame to re-measure
  //Rapid pan/zoom	- Use a useEffect hook tied to transform updates

  return (
    <canvas
      ref={overlayRef}
      className="pointer-events-none absolute top-0 left-0 z-50 size-full"
      width={container.clientWidth}
      height={container.clientHeight}
    />
  )
}

function rotateViewport(
  transform: Transform,
  media: Pick<Media, "exif"> | undefined,
  turn: QuarterTurn
) {
  const width = positiveDimension(transform.width ?? media?.exif?.width, 4_000)
  const height = positiveDimension(
    transform.height ?? media?.exif?.height,
    3_000
  )
  const derivedTransform = quarterTurnTransform(width, height, turn)
  return {
    transform: {
      ...composeAffine(transform, derivedTransform),
      width: derivedTransform.width!,
      height: derivedTransform.height!,
    },
    derivedTransform,
  }
}

function quarterTurnTransform(
  width: number,
  height: number,
  turn: QuarterTurn
): Transform {
  switch (turn) {
    case 1:
      return { a: 0, b: 1, c: -1, d: 0, e: height, f: 0, width: height, height: width }
    case 2:
      return { a: -1, b: 0, c: 0, d: -1, e: width, f: height, width, height }
    case 3:
      return { a: 0, b: -1, c: 1, d: 0, e: 0, f: width, width: height, height: width }
    default:
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, width, height }
  }
}

function positiveDimension(value: string | number | undefined, fallback: number) {
  const dimension = Number(value)
  return Number.isFinite(dimension) && dimension > 0 ? dimension : fallback
}

function isLandscape({ width, height }: Transform) {
  return (width ?? 0) >= (height ?? 0)
}

function toOverlay(
  [x, y]: [number, number],
  canvas: HTMLCanvasElement,
  canvasRect: DOMRect,
  containerRect: DOMRect
): [number, number] {
  const scaleX = canvasRect.width / canvas.width
  const scaleY = canvasRect.height / canvas.height

  const offsetX = canvasRect.left - containerRect.left
  const offsetY = canvasRect.top - containerRect.top

  return [offsetX + x * scaleX, offsetY + y * scaleY]
}

function transformPoint(
  [x, y]: [number, number],
  transform: DOMMatrix
): [number, number] {
  const point = new DOMPoint(x, y).matrixTransform(transform)
  return [point.x, point.y]
}

function isWithinViewport(
  [x, y]: [number, number],
  { width, height }: Pick<HTMLCanvasElement, "width" | "height">
) {
  return x >= 0 && x <= width && y >= 0 && y <= height
}
