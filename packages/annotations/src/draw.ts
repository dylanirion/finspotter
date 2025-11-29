export function strokeLineSegment(
  canvas: HTMLCanvasElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  lineWidth: number,
  strokeStyle: string,
  lineDash: number[] = []
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const weight = 1 / ctx.getTransform().a
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = lineWidth * weight
  ctx.strokeStyle = strokeStyle
  ctx.setLineDash(lineDash.map((segment) => segment * weight))
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.restore()
}

export function strokePoint(
  canvas: HTMLCanvasElement,
  point: { x: number; y: number },
  radius: number,
  lineWidth: number,
  strokeStyle: string
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const weight = 1 / ctx.getTransform().a
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = lineWidth * weight
  ctx.strokeStyle = strokeStyle
  ctx.beginPath()
  ctx.moveTo(point.x + radius * weight, point.y)
  ctx.arc(point.x, point.y, radius * weight, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function fillPoint(
  canvas: HTMLCanvasElement,
  point: { x: number; y: number },
  radius: number,
  fillStyle: string
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const weight = 1 / ctx.getTransform().a
  ctx.save()
  ctx.fillStyle = fillStyle
  ctx.beginPath()
  ctx.moveTo(point.x + radius * weight, point.y)
  ctx.arc(point.x, point.y, radius * weight, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
