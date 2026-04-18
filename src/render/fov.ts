import { Tile, type Floor, type Pos } from '../core/types'

export const FOV_RADIUS = 7

/**
 * Compute the set of tile indices visible from `from` on `floor` within
 * FOV_RADIUS tiles. Uses Chebyshev distance + Bresenham ray casts blocked
 * by Tile.Wall. The origin tile is always visible.
 *
 * Returns a Uint8Array of length floor.width*floor.height; index = 1 if visible.
 */
export function computeVisible(floor: Floor, from: Pos, radius: number = FOV_RADIUS): Uint8Array {
  const { width, height, tiles } = floor
  const out = new Uint8Array(width * height)

  // Hero's own tile always visible.
  if (inBounds(from, width, height)) {
    out[from.y * width + from.x] = 1
  }

  const minX = Math.max(0, from.x - radius)
  const maxX = Math.min(width - 1, from.x + radius)
  const minY = Math.max(0, from.y - radius)
  const maxY = Math.min(height - 1, from.y + radius)

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === from.x && y === from.y) continue
      const dx = x - from.x
      const dy = y - from.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue
      if (hasLineOfSight(tiles, width, height, from.x, from.y, x, y)) {
        out[y * width + x] = 1
      }
    }
  }

  return out
}

function inBounds(p: Pos, w: number, h: number): boolean {
  return p.x >= 0 && p.x < w && p.y >= 0 && p.y < h
}

/**
 * Bresenham-style line with wall blocking. Walls block sight but are themselves
 * visible when adjacent-or-reached (so you can see the wall that's blocking you).
 * The target tile is always considered reachable if the path up to it is clear.
 */
function hasLineOfSight(
  tiles: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    // Stop if we've reached the target.
    if (x === x1 && y === y1) return true
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
    // Check tile at new position. If it's a wall and NOT the destination,
    // the line is blocked past this point. The wall itself is still "seen" via
    // the loop in computeVisible when (x1,y1) hits that wall tile directly.
    if (x < 0 || y < 0 || x >= w || y >= h) return false
    if (x === x1 && y === y1) return true
    const t = tiles[y * w + x]
    if (t === Tile.Wall) return false
  }
}
