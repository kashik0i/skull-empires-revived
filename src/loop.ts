import { dispatch } from './core/dispatch'
import { decide } from './ai/planner'
import { runOutcome } from './core/selectors'
import type { Action, World } from './core/types'

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
  onRender: (state: World) => void,
  opts: { enemyTickMs: number } = { enemyTickMs: 300 },
): Loop {
  let state = initial
  let log: Action[] = []
  let running = false
  let lastEnemyTick = 0

  function apply(action: Action): void {
    const before = state
    const after = dispatch(state, action)
    if (after === before) return
    state = after
    log.push(action)
    const outcome = runOutcome(state)
    if (outcome && state.phase === 'exploring') {
      const end: Action = { type: 'RunEnd', outcome }
      state = dispatch(state, end)
      log.push(end)
    }
  }

  function tick(now: number): void {
    if (!running) return
    if (state.phase === 'exploring' && now - lastEnemyTick >= opts.enemyTickMs) {
      lastEnemyTick = now
      const currentId = state.turnOrder[state.turnIndex]
      const actor = state.actors[currentId]
      if (actor && actor.kind !== 'hero' && actor.alive) {
        apply(decide(state, currentId))
      }
      apply({ type: 'TurnAdvance' })
    }
    onRender(state)
    requestAnimationFrame(tick)
  }

  return {
    start() {
      if (running) return
      running = true
      lastEnemyTick = performance.now()
      requestAnimationFrame(tick)
    },
    stop() { running = false },
    replaceState(next) { state = next; log = [] },
    getState() { return state },
    submit(action) { apply(action); onRender(state) },
    getLog() { return log },
  }
}
