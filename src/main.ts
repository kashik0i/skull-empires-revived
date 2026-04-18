import { createInitialWorld } from './core/state'
import { createLoop } from './loop'
import { intentForClick } from './input/intent'
import { renderWorld } from './render/world'
import { mountHud } from './ui/hud'
import { mountOverlay } from './ui/overlay'
import { attachDevInput } from './input/dev'
import { encodeRun } from './persistence/url'
import { createDisplayState } from './render/display'
import { createFxBus } from './render/fx/bus'
import { createParticles } from './render/fx/particles'
import { createTweens } from './render/fx/tweens'
import { createFxCanvas } from './render/fx/canvas'
import { wirePresets } from './render/fx/presets'
import { createSfx } from './audio/sfx'
import { wireAudio } from './audio/subscribe'
import { createMusic } from './audio/music'
import { createFlags } from './dev/flags'
import { mountDevMenu, attachDevMenuHotkey } from './ui/devMenu'
import { createDbClient } from './persistence/db/client'
import { resolveInitialRun } from './persistence/autoResume'
import { computeCameraOffset } from './render/camera'
import type { CameraOffset } from './render/camera'
import { appendDevLog, resetDevLog, logDevEvent, setRunId, setStreamingEnabled } from './dev/runLog'
import { loadAtlas } from './render/sprites'
import { computeVisible } from './render/fov'
import { mountMinimap } from './ui/minimap'
import { mountDialog } from './ui/dialog'
import { mountInventory } from './ui/inventory'
import { mountItemReward } from './ui/itemReward'

const TILE_SIZE = 24
const PARTICLE_CAP = 500
const BASE_TICK_MS = 300

function floorKey(w: { run: { depth: number }; seed: string }): string {
  return `${w.seed}:${w.run.depth}`
}

function randomSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function main(): Promise<void> {
  const worldCanvas = document.getElementById('world') as HTMLCanvasElement
  const fxCanvas = document.getElementById('fx') as HTMLCanvasElement
  const hudContainer = document.getElementById('hud') as HTMLDivElement
  const worldCtx = worldCanvas.getContext('2d')
  const fxCtx = fxCanvas.getContext('2d')
  if (!worldCtx || !fxCtx) throw new Error('canvas 2d context unavailable')

  // Fire-and-forget — renderer falls back to procedural shapes until this resolves.
  void loadAtlas().catch(err => console.warn('[sprites] atlas failed to load', err))

  const params = new URLSearchParams(window.location.search)
  const runParam = params.get('run')

  const dbClient = createDbClient()
  const { world: initialWorld, runId, seed, source, resumedFromLog } = await resolveInitialRun({
    urlRunParam: runParam,
    dbClient,
    seedFn: randomSeed,
    runIdFn: () => crypto.randomUUID(),
    createFresh: (s) => createInitialWorld(s),
  })

  let world = initialWorld

  setRunId(runId)

  // Persist the run start for new/url-sourced runs
  if (source !== 'db') {
    resetDevLog(runId)
    await dbClient.startRun(runId, seed)
    // For url-sourced runs, replay-write the pre-existing log into DB
    if (source === 'url') {
      for (let i = 0; i < resumedFromLog.length; i++) {
        dbClient.appendEvent(runId, i, 0, JSON.stringify(resumedFromLog[i]))
        appendDevLog(resumedFromLog[i], world, i, 'replay')
      }
    }
  }

  const flags = createFlags()
  setStreamingEnabled(flags.get().debugLog)
  let lastFlagsJson = JSON.stringify(flags.get())
  flags.subscribe(next => {
    setStreamingEnabled(next.debugLog)
    const nextJson = JSON.stringify(next)
    if (nextJson !== lastFlagsJson) {
      logDevEvent('flags', { flags: next })
      lastFlagsJson = nextJson
    }
  })

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

  const music = createMusic(world.seed)
  music.setMoodForDepth(world.run.depth)
  flags.subscribe(next => { music.setVolume(next.volume * 0.5) })

  const hud = mountHud(hudContainer)
  hud.onDescend(() => loop.submit({ type: 'Descend' }))
  const minimap = mountMinimap(hudContainer)
  const overlay = mountOverlay(hudContainer)
  const dialog = mountDialog(hudContainer, (a) => loop.submit(a))
  const inventory = mountInventory(hudContainer, (a) => loop.submit(a))
  const itemReward = mountItemReward(hudContainer, (a) => loop.submit(a))
  const devMenu = mountDevMenu(hudContainer, flags)
  devMenu.setRunId(runId)
  attachDevMenuHotkey(devMenu)

  // FPS tracker: exponential moving average of 1/dtMs.
  let emaFps = 60
  const FPS_ALPHA = 0.08

  // Camera offset — updated each frame; read by dev input handler.
  let cameraOffset: CameraOffset = { x: 0, y: 0 }

  // Per-floor memory: tiles the hero has ever seen. Reset when the floor changes.
  let seenTiles = new Uint8Array(world.floor.width * world.floor.height)
  let lastFloorKey = floorKey(world)

  // Mutable state for DB bookkeeping — updated on restart
  let currentRunId = runId
  let logOffset = resumedFromLog.length

  const loop = createLoop(
    world,
    bus,
    (state, dtMs) => {
      if (dtMs > 0) emaFps = emaFps * (1 - FPS_ALPHA) + (1000 / dtMs) * FPS_ALPHA
      display.sync(state)
      display.tick(dtMs)
      fx.tick(dtMs)
      bus.drain()
      const heroDisp = display.get(state.heroId) ?? state.actors[state.heroId].pos
      cameraOffset = computeCameraOffset(
        { x: heroDisp.x * TILE_SIZE, y: heroDisp.y * TILE_SIZE },
        TILE_SIZE,
        worldCanvas.width,
        worldCanvas.height,
        state.floor.width,
        state.floor.height,
      )
      // Reset fog memory whenever the floor swaps.
      const nextKey = floorKey(state)
      if (nextKey !== lastFloorKey) {
        seenTiles = new Uint8Array(state.floor.width * state.floor.height)
        lastFloorKey = nextKey
      }
      renderWorld(worldCtx, state, display, {
        tileSize: TILE_SIZE,
        shakeOffset: fx.currentShakeOffset(),
        cameraOffset,
        showHeroPath: flags.get().showHeroPath,
        revealMap: flags.get().revealMap,
        seenTiles,
      })
      fx.draw(cameraOffset)
      hud.update(state)
      overlay.update(state)
      dialog.update(state)
      inventory.update(state)
      itemReward.update(state)
      minimap.update(state, seenTiles, flags.get().revealMap)
      devMenu.setFps(emaFps)
    },
    {
      enemyTickMs: () => BASE_TICK_MS / flags.get().tickSpeed,
      pauseEnemies: () => flags.get().pauseEnemies,
      heroInvincible: () => flags.get().invincibleHero,
      onAction(action, state) {
        const idx = logOffset++
        dbClient.appendEvent(currentRunId, idx, state.tick, JSON.stringify(action))
        appendDevLog(action, state, idx)
        if (action.type === 'Descend') music.setMoodForDepth(state.run.depth)
        if (action.type === 'RunEnd') {
          const outcome = action.outcome === 'won' ? 'win' : 'loss'
          void dbClient.endRun(currentRunId, outcome, state.tick)
        }
      },
    },
  )

  async function createReplacement() {
    const newSeed = randomSeed()
    const newRunId = crypto.randomUUID()
    currentRunId = newRunId
    logOffset = 0
    setRunId(newRunId)
    resetDevLog(newRunId)
    devMenu.setRunId(newRunId)
    const newWorld = createInitialWorld(newSeed)
    loop.replaceState(newWorld)
    display.sync(loop.getState())
    seenTiles = new Uint8Array(newWorld.floor.width * newWorld.floor.height)
    lastFloorKey = floorKey(newWorld)
    await dbClient.startRun(newRunId, newSeed)
  }

  function tileIsKnown(s: typeof world, tile: { x: number; y: number }): boolean {
    if (flags.get().revealMap) return true
    if (tile.x < 0 || tile.y < 0 || tile.x >= s.floor.width || tile.y >= s.floor.height) return false
    const idx = tile.y * s.floor.width + tile.x
    if (seenTiles[idx]) return true
    // Current FOV — freshly computed if hero moved this frame but seenTiles hasn't folded it in yet.
    const hero = s.actors[s.heroId]
    if (!hero) return false
    const vis = computeVisible(s.floor, hero.pos)
    return vis[idx] === 1
  }

  attachDevInput(worldCanvas, TILE_SIZE, {
    onTileClick(tile) {
      const s = loop.getState()
      if (s.phase !== 'exploring') return
      // Block interaction with tiles the hero hasn't discovered.
      if (!tileIsKnown(s, tile)) return
      const action = intentForClick(s, tile)
      if (action) loop.submit(action)
    },
    onPauseToggle() { /* reserved */ },
    onRestart() { void createReplacement() },
  }, () => cameraOffset)

  overlay.onRestart(() => { void createReplacement() })
  overlay.onShare(() => {
    const s = loop.getState()
    const encoded = encodeRun(s.seed, loop.getLog())
    const url = `${window.location.origin}${window.location.pathname}?dev=1&run=${encodeURIComponent(encoded)}`
    void navigator.clipboard?.writeText(url).catch(() => {})
    window.prompt('Share URL (copy me):', url)
  })

  loop.start()

  const unlockOnce = () => {
    music.start()
    window.removeEventListener('mousedown', unlockOnce)
    window.removeEventListener('keydown', unlockOnce)
  }
  window.addEventListener('mousedown', unlockOnce)
  window.addEventListener('keydown', unlockOnce)
}

main()
