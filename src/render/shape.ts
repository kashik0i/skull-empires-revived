import type { PaletteKey } from '../content/palette'

export type RectShape = { type: 'rect'; w: number; h: number; color: PaletteKey; corner: number }
export type StripShape = { type: 'strip'; y: number; h: number; color: PaletteKey }
export type CircleShape = { type: 'circle'; y: number; r: number; color: PaletteKey }
export type EyeDotsShape = { type: 'eyeDots'; y: number; spacing: number; r: number; color: PaletteKey }

export type ShapeRecipe = {
  body: RectShape
  accent?: StripShape
  head?: CircleShape
  eyes?: EyeDotsShape
}

export function validateShapeRecipe(v: unknown): v is ShapeRecipe {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  const body = o.body as Record<string, unknown> | undefined
  if (!body || body.type !== 'rect') return false
  if (typeof body.w !== 'number' || typeof body.h !== 'number' || typeof body.corner !== 'number') return false
  if (typeof body.color !== 'string') return false
  if (o.accent) {
    const a = o.accent as Record<string, unknown>
    if (a.type !== 'strip') return false
  }
  if (o.head) {
    const h = o.head as Record<string, unknown>
    if (h.type !== 'circle') return false
  }
  if (o.eyes) {
    const e = o.eyes as Record<string, unknown>
    if (e.type !== 'eyeDots') return false
  }
  return true
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  recipe: ShapeRecipe,
  centerX: number, centerY: number,
  tileSize: number,
  resolveColor: (key: PaletteKey) => string,
): void {
  const { body, accent, head, eyes } = recipe
  const bw = body.w * tileSize
  const bh = body.h * tileSize
  const bx = centerX - bw / 2
  const by = centerY - bh / 2 + tileSize * 0.05
  const r = body.corner * tileSize
  ctx.fillStyle = resolveColor(body.color)
  roundedRect(ctx, bx, by, bw, bh, r)
  ctx.fill()
  if (accent) {
    const ax = bx
    const ay = centerY + accent.y * tileSize
    ctx.fillStyle = resolveColor(accent.color)
    ctx.fillRect(ax, ay, bw, accent.h * tileSize)
  }
  if (head) {
    ctx.fillStyle = resolveColor(head.color)
    ctx.beginPath()
    ctx.arc(centerX, centerY + head.y * tileSize, head.r * tileSize, 0, Math.PI * 2)
    ctx.fill()
  }
  if (eyes) {
    ctx.fillStyle = resolveColor(eyes.color)
    const ey = centerY + eyes.y * tileSize
    const dx = eyes.spacing * tileSize
    const er = eyes.r * tileSize
    ctx.beginPath()
    ctx.arc(centerX - dx, ey, er, 0, Math.PI * 2)
    ctx.arc(centerX + dx, ey, er, 0, Math.PI * 2)
    ctx.fill()
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}
