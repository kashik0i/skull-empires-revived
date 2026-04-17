import { createInitialWorld } from './core/state'
import { createLoop } from './loop'
import { intentForClick } from './input/intent'
import { renderWorld } from './render/world'
import { mountHud } from './ui/hud'
import { mountOverlay } from './ui/overlay'
import { mountCardHand } from './ui/cardHand'
import { mountCardReward } from './ui/cardReward'
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
import { createFlags } from './dev/flags'
import { mountDevMenu, attachDevMenuHotkey } from './ui/devMenu'
import { createDbClient } from './persistence/db/client'
import { resolveInitialRun } from './persistence/autoResume'

const TILE_SIZE = 24
const PARTICLE_CAP = 500
const FAST_TICK_MS = 300
const SLOW_TICK_MS = 1000

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

  // Persist the run start for new/url-sourced runs
  if (source !== 'db') {
    await dbClient.startRun(runId, seed)
    // For url-sourced runs, replay-write the pre-existing log into DB
    if (source === 'url') {
      for (let i = 0; i < resumedFromLog.length; i++) {
        dbClient.appendEvent(runId, i, 0, JSON.stringify(resumedFromLog[i]))
      }
    }
  }

  const flags = createFlags()

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
  let targetingCardId: string | null = null
  const cardHand = mountCardHand(
    hudContainer,
    (cardId, targetId) => {
      targetingCardId = null
      if (targetId) {
        loop.submit({ type: 'PlayCard', cardId, targetId })
      } else {
        loop.submit({ type: 'PlayCard', cardId })
      }
    },
    () => {
      targetingCardId = cardHand.getTargetingCardId()
    },
    () => {
      targetingCardId = null
      cardHand.cancelTargeting()
    },
  )
  const cardReward = mountCardReward(hudContainer, (cardId) => {
    loop.submit({ type: 'PickCardReward', cardId })
  })
  const devMenu = mountDevMenu(hudContainer, flags)
  attachDevMenuHotkey(devMenu)

  // FPS tracker: exponential moving average of 1/dtMs.
  let emaFps = 60
  const FPS_ALPHA = 0.08

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
      renderWorld(worldCtx, state, display, {
        tileSize: TILE_SIZE,
        shakeOffset: fx.currentShakeOffset(),
        showHeroPath: flags.get().showHeroPath,
      })
      fx.draw()
      hud.update(state)
      overlay.update(state)
      cardReward.update(state)
      cardHand.update(state)
      devMenu.setFps(emaFps)
    },
    {
      enemyTickMs: () => flags.get().slowMotion ? SLOW_TICK_MS : FAST_TICK_MS,
      onAction(action, state) {
        const idx = logOffset++
        dbClient.appendEvent(currentRunId, idx, state.tick, JSON.stringify(action))
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
    const newWorld = createInitialWorld(newSeed)
    loop.replaceState(newWorld)
    display.sync(loop.getState())
    await dbClient.startRun(newRunId, newSeed)
  }

  attachDevInput(worldCanvas, TILE_SIZE, {
    onTileClick(tile) {
      const s = loop.getState()
      if (s.phase !== 'exploring') return
      // If targeting mode is active, try to play card on enemy at tile
      if (targetingCardId) {
        const actor = Object.values(s.actors).find(a => a.pos.x === tile.x && a.pos.y === tile.y && a.kind === 'enemy')
        if (actor) {
          loop.submit({ type: 'PlayCard', cardId: targetingCardId, targetId: actor.id })
          targetingCardId = null
          cardHand.cancelTargeting()
        } else {
          // Cancel targeting if not on enemy
          targetingCardId = null
          cardHand.cancelTargeting()
        }
        return
      }
      const action = intentForClick(s, tile)
      if (action) loop.submit(action)
    },
    onPauseToggle() { /* reserved */ },
    onRestart() { void createReplacement() },
  })

  overlay.onRestart(() => { void createReplacement() })
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
