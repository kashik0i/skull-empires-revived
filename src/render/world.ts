import { Tile, type World } from '../core/types'
import { getArchetype } from '../content/loader'

export type RenderOptions = {
  tileSize: number
}

export function renderWorld(ctx: CanvasRenderingContext2D, state: World, opts: RenderOptions): void {
  const { tileSize } = opts
  const { floor } = state
  ctx.fillStyle = '#0b0612'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const t = floor.tiles[y * floor.width + x]
      if (t === Tile.Floor) {
        ctx.fillStyle = '#2a1c3a'
        ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1)
      } else if (t === Tile.Wall) {
        ctx.fillStyle = '#1a1024'
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
      }
    }
  }
  for (const id in state.actors) {
    const a = state.actors[id]
    if (!a.alive) continue
    const def = getArchetype(a.archetype)
    const cx = a.pos.x * tileSize + tileSize / 2
    const cy = a.pos.y * tileSize + tileSize / 2
    ctx.fillStyle = def.color
    ctx.beginPath()
    ctx.arc(cx, cy, tileSize * 0.35, 0, Math.PI * 2)
    ctx.fill()
    if (a.kind === 'enemy' || a.kind === 'hero') {
      ctx.fillStyle = '#120a1c'
      ctx.beginPath()
      ctx.arc(cx - tileSize * 0.1, cy - tileSize * 0.05, tileSize * 0.05, 0, Math.PI * 2)
      ctx.arc(cx + tileSize * 0.1, cy - tileSize * 0.05, tileSize * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
