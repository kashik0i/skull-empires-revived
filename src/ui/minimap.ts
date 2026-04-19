import { Tile, type World } from '../core/types'
import { palette } from '../content/palette'
import { focusedWindow, type WindowRect } from './minimapWindow'

export type MinimapMode = 'focused' | 'full'
export type Minimap = {
  root: HTMLElement
  update(state: World, seenTiles: Uint8Array | null, revealMap: boolean): void
  setMode(mode: MinimapMode): void
  getMode(): MinimapMode
}

const MINIMAP_SCALE = 4
const FOCUSED_RADIUS = 8

export function mountMinimap(parent: HTMLElement): Minimap {
  const wrapper = document.createElement('div')
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  } satisfies Partial<CSSStyleDeclaration>)
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  Object.assign(canvas.style, {
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    background: 'rgba(11, 6, 18, 0.85)',
    imageRendering: 'pixelated',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>)
  wrapper.appendChild(canvas)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.textContent = 'Zoom: focused'
  Object.assign(toggle.style, {
    background: '#2a1a3e',
    color: '#eadbc0',
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    padding: '4px 8px',
    fontFamily: 'inherit',
    fontSize: '11px',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>)
  wrapper.appendChild(toggle)
  parent.appendChild(wrapper)

  const ctx = canvas.getContext('2d')!
  let mode: MinimapMode = 'full'
  let lastSize = { w: 0, h: 0 }
  let lastFloorKey = ''

  function setLabel() { toggle.textContent = `Zoom: ${mode}` }
  setLabel()

  function setMode(next: MinimapMode) { mode = next; setLabel() }

  canvas.addEventListener('click', () => setMode(mode === 'focused' ? 'full' : 'focused'))
  toggle.addEventListener('click', () => setMode(mode === 'focused' ? 'full' : 'focused'))

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
    // Auto-pick mode on first encounter with this floor: large floors → focused, small → full.
    const floorKey = `${state.seed}:${state.run.depth}`
    if (floorKey !== lastFloorKey) {
      mode = floor.width > 40 ? 'focused' : 'full'
      setLabel()
      lastFloorKey = floorKey
    }

    const hero = state.actors[state.heroId]
    let win: WindowRect
    if (mode === 'focused' && hero) {
      win = focusedWindow(hero.pos, floor.width, floor.height, FOCUSED_RADIUS)
    } else {
      win = { x0: 0, y0: 0, x1: floor.width - 1, y1: floor.height - 1, width: floor.width, height: floor.height }
    }
    resizeIfNeeded(win.width, win.height)

    ctx.fillStyle = palette.obsidianBlack
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const everythingVisible = revealMap || !seenTiles

    for (let y = win.y0; y <= win.y1; y++) {
      for (let x = win.x0; x <= win.x1; x++) {
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
          ctx.fillRect((x - win.x0) * MINIMAP_SCALE, (y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
        }
      }
    }

    function inWindow(p: { x: number; y: number }): boolean {
      return p.x >= win.x0 && p.x <= win.x1 && p.y >= win.y0 && p.y <= win.y1
    }

    for (const item of state.droppedItems) {
      if (!inWindow(item.pos)) continue
      const idx = item.pos.y * floor.width + item.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect((item.pos.x - win.x0) * MINIMAP_SCALE, (item.pos.y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }
    for (const ground of state.groundItems) {
      if (!inWindow(ground.pos)) continue
      const idx = ground.pos.y * floor.width + ground.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect((ground.pos.x - win.x0) * MINIMAP_SCALE, (ground.pos.y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }
    for (const scroll of state.loreScrolls) {
      if (!inWindow(scroll.pos)) continue
      const idx = scroll.pos.y * floor.width + scroll.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect((scroll.pos.x - win.x0) * MINIMAP_SCALE, (scroll.pos.y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }

    for (const a of Object.values(state.actors)) {
      if (!a.alive) continue
      const isHero = a.id === state.heroId
      if (!inWindow(a.pos)) continue
      const idx = a.pos.y * floor.width + a.pos.x
      if (!isHero && !everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = isHero ? palette.boneWhite : palette.bloodCrimson
      const px = (a.pos.x - win.x0) * MINIMAP_SCALE - 1
      const py = (a.pos.y - win.y0) * MINIMAP_SCALE - 1
      ctx.fillRect(px, py, MINIMAP_SCALE + 2, MINIMAP_SCALE + 2)
    }
  }

  return { root: wrapper, update, setMode, getMode: () => mode }
}
