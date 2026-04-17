import { createInitialWorld } from './core/state'
import { createLoop } from './loop'
import { intentForClick } from './input/intent'
import { renderWorld } from './render/world'
import { mountHud } from './ui/hud'
import { mountOverlay } from './ui/overlay'
import { attachDevInput } from './input/dev'
import { encodeRun, decodeRun } from './persistence/url'
import { replay } from './persistence/replay'
import { createDisplayState } from './render/display'
import { createFxBus } from './render/fx/bus'
import { createParticles } from './render/fx/particles'
import { createTweens } from './render/fx/tweens'
import { createFxCanvas } from './render/fx/canvas'
import { wirePresets } from './render/fx/presets'
import { createSfx } from './audio/sfx'
import { wireAudio } from './audio/subscribe'

const TILE_SIZE = 24
const PARTICLE_CAP = 500

function randomSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function main(): void {
  const worldCanvas = document.getElementById('world') as HTMLCanvasElement
  const fxCanvas = document.getElementById('fx') as HTMLCanvasElement
  const hudContainer = document.getElementById('hud') as HTMLDivElement
  const worldCtx = worldCanvas.getContext('2d')
  const fxCtx = fxCanvas.getContext('2d')
  if (!worldCtx || !fxCtx) throw new Error('canvas 2d context unavailable')

  const params = new URLSearchParams(window.location.search)
  const runParam = params.get('run')
  const seedParam = params.get('seed')
  const initialSeed = seedParam ?? randomSeed()
  let world = createInitialWorld(initialSeed)
  if (runParam) {
    const decoded = decodeRun(runParam)
    if (decoded) world = replay(decoded.seed, decoded.log)
  }

  const bus = createFxBus()
  const particles = createParticles({ capacity: PARTICLE_CAP })
  const tweens = createTweens()
  const display = createDisplayState()
  display.sync(world)
  const fx = createFxCanvas(fxCtx, particles, tweens)
  wirePresets(bus, fx, particles, display)

  const sfx = createSfx([
    { id: 'step',   src: '/audio/step.mp3',   poolSize: 1 },
    { id: 'hit',    src: '/audio/hit.mp3',    poolSize: 3 },
    { id: 'death',  src: '/audio/death.mp3',  poolSize: 2 },
    { id: 'attack', src: '/audio/attack.mp3', poolSize: 3 },
    { id: 'click',  src: '/audio/click.mp3',  poolSize: 1 },
  ], { volume: 0.5 })
  wireAudio(bus, sfx, world.heroId)

  const hud = mountHud(hudContainer)
  const overlay = mountOverlay(hudContainer)

  const loop = createLoop(world, bus, (state, dtMs) => {
    display.sync(state)
    display.tick(dtMs)
    fx.tick(dtMs)
    bus.drain()
    renderWorld(worldCtx, state, display, { tileSize: TILE_SIZE, shakeOffset: fx.currentShakeOffset() })
    fx.draw()
    hud.update(state)
    overlay.update(state)
  })

  function createReplacement() { return createInitialWorld(randomSeed()) }

  attachDevInput(worldCanvas, TILE_SIZE, {
    onTileClick(tile) {
      const s = loop.getState()
      if (s.phase !== 'exploring') return
      const action = intentForClick(s, tile)
      if (action) loop.submit(action)
    },
    onPauseToggle() { /* reserved */ },
    onRestart() { loop.replaceState(createReplacement()); display.sync(loop.getState()) },
  })

  overlay.onRestart(() => { loop.replaceState(createReplacement()); display.sync(loop.getState()) })
  overlay.onShare(() => {
    const s = loop.getState()
    const encoded = encodeRun(s.seed, loop.getLog())
    const url = `${window.location.origin}${window.location.pathname}?dev=1&run=${encodeURIComponent(encoded)}`
    void navigator.clipboard?.writeText(url).catch(() => {})
    window.prompt('Share URL (copy me):', url)
  })

  loop.start()
}

main()
