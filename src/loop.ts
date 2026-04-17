import { dispatchWithFx } from './core/dispatch'
import { decide } from './ai/planner'
import { resolveHeroActions } from './ai/heroAuto'
import { runOutcome } from './core/selectors'
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

export function createLoop(
  initial: World,
  bus: FxBus,
  onFrame: (state: World, dtMs: number) => void,
  opts: { enemyTickMs: number } = { enemyTickMs: 300 },
): Loop {
  let state = initial
  let log: Action[] = []
  let running = false
  let lastTickMs = 0
  let lastFrameMs = 0

  function apply(action: Action): void {
    const before = state
    const after = dispatchWithFx(state, action, bus)
    if (after === before) return
    state = after
    log.push(action)
    const outcome = runOutcome(state)
    if (outcome && state.phase === 'exploring') {
      const end: Action = { type: 'RunEnd', outcome }
      state = dispatchWithFx(state, end, bus)
      log.push(end)
    }
  }

  function runCurrentActor(): void {
    const currentId = state.turnOrder[state.turnIndex]
    const actor = state.actors[currentId]
    if (!actor || !actor.alive) return
    if (actor.kind === 'hero') {
      for (const a of resolveHeroActions(state)) apply(a)
    } else {
      apply(decide(state, currentId))
    }
  }

  function frame(nowMs: number): void {
    if (!running) return
    const dtMs = lastFrameMs === 0 ? 16 : nowMs - lastFrameMs
    lastFrameMs = nowMs
    if (state.phase === 'exploring' && nowMs - lastTickMs >= opts.enemyTickMs) {
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
            lastTickMs = performance.now()
          }
        }
      }
    },
    getLog() { return log },
  }
}
