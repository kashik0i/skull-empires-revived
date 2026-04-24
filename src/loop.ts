import { dispatchWithFx } from './core/dispatch'
import { decide } from './ai/planner'
import { resolveHeroActions } from './ai/heroAuto'
import { runOutcome } from './core/selectors'
import { itemPoolForDepth } from './content/itemLoader'
import type { Action, World } from './core/types'
import type { FxBus } from './render/fx/bus'

export type Loop = {
  start(): void
  stop(): void
  replaceState(next: World): void
  getState(): World
  submit(action: Action): void
  getLog(): readonly Action[]
}

export type LoopOptions = {
  enemyTickMs: number | (() => number)
  /** Called after each action is successfully applied and pushed to the log. */
  onAction?: (action: Action, world: World) => void
  /** When truthy, enemy turns are skipped (still advance). */
  pauseEnemies?: () => boolean
  /** When truthy, attacks targeting the hero are dropped silently. */
  heroInvincible?: () => boolean
}

export function createLoop(
  initial: World,
  bus: FxBus,
  onFrame: (state: World, dtMs: number) => void,
  opts: LoopOptions = { enemyTickMs: 300 },
): Loop {
  const getTickMs = typeof opts.enemyTickMs === 'function' ? opts.enemyTickMs : () => opts.enemyTickMs as number
  const onAction = opts.onAction
  const pauseEnemies = opts.pauseEnemies ?? (() => false)
  const heroInvincible = opts.heroInvincible ?? (() => false)
  let state = initial
  let log: Action[] = []
  let running = false
  let lastTickMs = 0
  let lastFrameMs = 0
  // Real-time hero cadence — decouples hero pace from turn-order rotation so a
  // lone-hero floor doesn't speed up to tick-rate just because no enemies share
  // the rotation. Set to `getTickMs()` on each check so dev-menu tickSpeed still
  // applies.
  let lastHeroActMs = 0

  function apply(action: Action): void {
    if (
      action.type === 'AttackActor'
      && action.targetId === state.heroId
      && heroInvincible()
    ) return

    const before = state
    const after = dispatchWithFx(state, action, bus)
    if (after === before) return
    state = after
    log.push(action)
    onAction?.(action, state)
    const outcome = runOutcome(state)
    if (outcome && state.phase === 'exploring') {
      const end: Action = { type: 'RunEnd', outcome }
      state = dispatchWithFx(state, end, bus)
      log.push(end)
      onAction?.(end, state)
      return
    }
    maybeOfferReward()
  }

  function maybeOfferReward(): void {
    if (state.phase !== 'exploring') return
    if (state.run.pendingItemReward !== null) return
    if (state.run.rewardedThisFloor) return
    if (state.run.depth >= 5) return
    const anyEnemyAlive = Object.values(state.actors).some(a => a.kind === 'enemy' && a.alive)
    if (anyEnemyAlive) return

    const nextDepth = Math.min(5, state.run.depth + 1)
    const pool = itemPoolForDepth(nextDepth).slice()
    const choices: string[] = []
    const picked = new Set<number>()
    while (choices.length < 3 && picked.size < pool.length) {
      const idx = Math.floor(Math.random() * pool.length)
      if (picked.has(idx)) continue
      picked.add(idx)
      choices.push(pool[idx])
    }
    const offer: Action = { type: 'OfferItemReward', itemIds: choices }
    state = dispatchWithFx(state, offer, bus)
    log.push(offer)
    onAction?.(offer, state)
  }

  function runCurrentActor(): void {
    const currentId = state.turnOrder[state.turnIndex]
    const actor = state.actors[currentId]
    if (!actor || !actor.alive) return
    if (actor.kind === 'hero') {
      // Hero cooldown: never move faster than one action per tick interval in
      // wall-clock time. When enemies are alive this is naturally paced by turn
      // rotation; when the floor is clear the hero would otherwise tick at
      // frame rate.
      const now = performance.now()
      if (now - lastHeroActMs < getTickMs()) return
      const actions = resolveHeroActions(state)
      if (actions.length > 0) lastHeroActMs = now
      for (const a of actions) apply(a)
    } else {
      if (pauseEnemies()) return
      apply(decide(state, currentId))
    }
  }

  function frame(nowMs: number): void {
    if (!running) return
    const dtMs = lastFrameMs === 0 ? 16 : nowMs - lastFrameMs
    lastFrameMs = nowMs
    // Freeze enemy/hero ticks while a dialog is open so the player can read
     // the modal without taking damage from adjacent enemies.
    if (state.phase === 'exploring' && state.pendingDialog === null && nowMs - lastTickMs >= getTickMs()) {
      lastTickMs = nowMs
      runCurrentActor()
      apply({ type: 'TurnAdvance' })
    }
    onFrame(state, dtMs)
    requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      lastTickMs = performance.now()
      lastFrameMs = 0
      requestAnimationFrame(frame)
    },
    stop() { running = false },
    replaceState(next) { state = next; log = [] },
    getState() { return state },
    submit(action) {
      apply(action)
      // Snappy feel: if the click just set hero intent and it's hero's turn, resolve immediately.
      if (action.type === 'SetHeroIntent' && state.phase === 'exploring') {
        const currentId = state.turnOrder[state.turnIndex]
        if (currentId === state.heroId) {
          const heroActions = resolveHeroActions(state)
          if (heroActions.length > 0) {
            for (const a of heroActions) apply(a)
            apply({ type: 'TurnAdvance' })
            const now = performance.now()
            lastTickMs = now
            lastHeroActMs = now
          }
        }
      }
    },
    getLog() { return log },
  }
}
