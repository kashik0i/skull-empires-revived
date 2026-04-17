import { createInitialWorld } from './core/state'
import { createLoop } from './loop'
import { intentForClick } from './input/intent'
import { renderWorld } from './render/world'
import { mountHud } from './ui/hud'
import { mountOverlay } from './ui/overlay'
import { attachDevInput } from './input/dev'
import { encodeRun, decodeRun } from './persistence/url'
import { replay } from './persistence/replay'

const TILE_SIZE = 24

function randomSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function main(): void {
  const canvas = document.getElementById('world') as HTMLCanvasElement
  const hudContainer = document.getElementById('hud') as HTMLDivElement
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  const params = new URLSearchParams(window.location.search)
  const runParam = params.get('run')
  const seedParam = params.get('seed')
  const initialSeed = seedParam ?? randomSeed()
  let world = createInitialWorld(initialSeed)
  if (runParam) {
    const decoded = decodeRun(runParam)
    if (decoded) world = replay(decoded.seed, decoded.log)
  }

  const hud = mountHud(hudContainer)
  const overlay = mountOverlay(hudContainer)

  const loop = createLoop(world, state => {
    renderWorld(ctx, state, { tileSize: TILE_SIZE })
    hud.update(state)
    overlay.update(state)
  })

  function createReplacement() {
    return createInitialWorld(randomSeed())
  }

  attachDevInput(canvas, TILE_SIZE, {
    onTileClick(tile) {
      const s = loop.getState()
      if (s.phase !== 'exploring') return
      const action = intentForClick(s, tile)
      if (action) loop.submit(action)
    },
    onPauseToggle() { /* 1A has no pause state yet */ },
    onRestart() { loop.replaceState(createReplacement()) },
  })

  overlay.onRestart(() => { loop.replaceState(createReplacement()) })
  overlay.onShare(() => {
    const s = loop.getState()
    const encoded = encodeRun(s.seed, loop.getLog())
    const url = `${window.location.origin}${window.location.pathname}?dev=1&run=${encodeURIComponent(encoded)}`
    void navigator.clipboard?.writeText(url).catch(() => { /* ignore */ })
    window.prompt('Share URL (copy me):', url)
  })

  loop.start()
}

main()
