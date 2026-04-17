import { dispatchWithFx } from './core/dispatch'
import { decide } from './ai/planner'
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
  let lastEnemyTickMs = 0
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

  function frame(nowMs: number): void {
    if (!running) return
    const dtMs = lastFrameMs === 0 ? 16 : nowMs - lastFrameMs
    lastFrameMs = nowMs
    if (state.phase === 'exploring' && nowMs - lastEnemyTickMs >= opts.enemyTickMs) {
      lastEnemyTickMs = nowMs
      const currentId = state.turnOrder[state.turnIndex]
      const actor = state.actors[currentId]
      if (actor && actor.kind !== 'hero' && actor.alive) apply(decide(state, currentId))
      apply({ type: 'TurnAdvance' })
    }
    onFrame(state, dtMs)
    requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      lastEnemyTickMs = performance.now()
      lastFrameMs = 0
      requestAnimationFrame(frame)
    },
    stop() { running = false },
    replaceState(next) { state = next; log = [] },
    getState() { return state },
    submit(action) { apply(action) },
    getLog() { return log },
  }
}
