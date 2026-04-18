import { Tile, type World } from '../core/types'
import { palette } from '../content/palette'

export type Minimap = {
  root: HTMLElement
  update(state: World, seenTiles: Uint8Array | null, revealMap: boolean): void
}

const MINIMAP_SCALE = 4 // px per tile

export function mountMinimap(container: HTMLElement): Minimap {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  Object.assign(canvas.style, {
    position: 'absolute',
    top: '8px',
    right: '8px',
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    background: 'rgba(11, 6, 18, 0.85)',
    imageRendering: 'pixelated',
    zIndex: '3',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  let lastSize = { w: 0, h: 0 }

  function resizeIfNeeded(w: number, h: number) {
    const px = w * MINIMAP_SCALE
    const py = h * MINIMAP_SCALE
    if (lastSize.w !== px || lastSize.h !== py) {
      canvas.width = px
      canvas.height = py
      canvas.style.width = `${px}px`
      canvas.style.height = `${py}px`
      lastSize = { w: px, h: py }
    }
  }

  function update(state: World, seenTiles: Uint8Array | null, revealMap: boolean): void {
    const { floor } = state
    resizeIfNeeded(floor.width, floor.height)

    ctx.fillStyle = palette.obsidianBlack
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const everythingVisible = revealMap || !seenTiles

    // Tile pass
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        const idx = y * floor.width + x
        if (!everythingVisible && !seenTiles[idx]) continue
        const t = floor.tiles[idx]
        let color: string | null = null
        if (t === Tile.Floor) color = palette.deepPurpleLite
        else if (t === Tile.Wall) color = palette.deepPurple
        else if (t === Tile.Stairs) color = palette.silkFlameAmber
        else if (t === Tile.Shrine) color = palette.bloodCrimson
        if (color) {
          ctx.fillStyle = color
          ctx.fillRect(x * MINIMAP_SCALE, y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
        }
      }
    }

    // Items — only if tile is currently seen
    for (const item of state.droppedItems) {
      const idx = item.pos.y * floor.width + item.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect(item.pos.x * MINIMAP_SCALE, item.pos.y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }

    // Scrolls — only if tile is currently seen
    for (const scroll of state.loreScrolls) {
      const idx = scroll.pos.y * floor.width + scroll.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect(scroll.pos.x * MINIMAP_SCALE, scroll.pos.y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }

    // Actors — hero always, enemies only if tile is seen
    for (const a of Object.values(state.actors)) {
      if (!a.alive) continue
      const isHero = a.id === state.heroId
      const idx = a.pos.y * floor.width + a.pos.x
      if (!isHero && !everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = isHero ? palette.boneWhite : palette.bloodCrimson
      // Dot a little bigger than a tile for visibility
      const px = a.pos.x * MINIMAP_SCALE - 1
      const py = a.pos.y * MINIMAP_SCALE - 1
      ctx.fillRect(px, py, MINIMAP_SCALE + 2, MINIMAP_SCALE + 2)
    }
  }

  return { root: canvas, update }
}
