import { Tile, type World } from '../core/types'
import { getArchetype } from '../content/loader'
import { palette } from '../content/palette'
import { drawShape } from './shape'
import type { DisplayState } from './display'

export type RenderOptions = {
  tileSize: number
  shakeOffset: { x: number; y: number }
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  state: World,
  display: DisplayState,
  opts: RenderOptions,
): void {
  const { tileSize, shakeOffset } = opts
  const { floor } = state
  ctx.save()
  ctx.translate(shakeOffset.x, shakeOffset.y)
  ctx.fillStyle = palette.obsidianBlack
  ctx.fillRect(-shakeOffset.x, -shakeOffset.y, ctx.canvas.width, ctx.canvas.height)
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const t = floor.tiles[y * floor.width + x]
      if (t === Tile.Floor) {
        ctx.fillStyle = palette.deepPurpleLite
        ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1)
      } else if (t === Tile.Wall) {
        ctx.fillStyle = palette.deepPurple
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
      }
    }
  }
  for (const d of display.all()) {
    const actor = state.actors[d.id]
    if (!actor || !actor.alive) continue
    const def = getArchetype(actor.archetype)
    const cx = d.x * tileSize + tileSize / 2
    const cy = d.y * tileSize + tileSize / 2
    drawShape(ctx, def.shape, cx, cy, tileSize, key => palette[key])
  }
  ctx.restore()
}
