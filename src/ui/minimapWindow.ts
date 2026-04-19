export type WindowRect = { x0: number; y0: number; x1: number; y1: number; width: number; height: number }

export function focusedWindow(
  hero: { x: number; y: number },
  floorW: number,
  floorH: number,
  radius: number,
): WindowRect {
  const x0 = Math.max(0, hero.x - radius)
  const y0 = Math.max(0, hero.y - radius)
  const x1 = Math.min(floorW - 1, hero.x + radius)
  const y1 = Math.min(floorH - 1, hero.y + radius)
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}
