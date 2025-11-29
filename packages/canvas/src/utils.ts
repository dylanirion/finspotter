import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clientToCanvas(
  x: number,
  y: number,
  canvas: HTMLCanvasElement
) {
  const { left, top } = canvas.getBoundingClientRect()
  const canvasScale = canvas.width / canvas.offsetWidth
  return {
    x: (x - left) * canvasScale,
    y: (y - top) * canvasScale,
  }
}

export function canvasToImage(x: number, y: number, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return { x: undefined, y: undefined, a: undefined }
  const { a, e, f } = ctx.getTransform()
  return {
    x: (x - e) / a,
    y: (y - f) / a,
    a,
  }
}

export function clientToImage(x: number, y: number, canvas: HTMLCanvasElement) {
  const { x: canvasX, y: canvasY } = clientToCanvas(x, y, canvas)
  return canvasToImage(canvasX, canvasY, canvas)
}

export function canvasToClient(
  x: number,
  y: number,
  canvas: HTMLCanvasElement
) {
  const { left, top } = canvas.getBoundingClientRect()
  const canvasScale = canvas.width / canvas.offsetWidth
  return {
    x: x / canvasScale + left,
    y: y / canvasScale + top,
  }
}

export function imageToCanvas(x: number, y: number, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return { x: undefined, y: undefined, a: undefined }
  const { a, e, f } = ctx.getTransform()
  return {
    x: x * a + e,
    y: y * a + f,
  }
}

export function imageToClient(x: number, y: number, canvas: HTMLCanvasElement) {
  const { x: canvasX, y: canvasY } = imageToCanvas(x, y, canvas)
  return canvasX && canvasY
    ? canvasToClient(canvasX, canvasY, canvas)
    : { x: undefined, y: undefined }
}

export function greatestCommonDivisor(x: number, y: number): number {
  if (y == 0) {
    return x
  }
  return greatestCommonDivisor(y, x % y)
}

export function dimensionsToAspectString(
  width: string | number | undefined,
  height: string | number | undefined
) {
  if (!width && !height) return undefined
  const gcd = greatestCommonDivisor(Number(width), Number(height))
  return `${Number(width) / gcd}/${Number(height) / gcd}`
}
