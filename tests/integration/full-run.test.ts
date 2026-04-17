import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { dispatch } from '../../src/core/dispatch'
import { decide } from '../../src/ai/planner'
import { runOutcome } from '../../src/core/selectors'
import type { Action, World } from '../../src/core/types'

function simulate(seed: string, heroActions: Action[]): { final: World; log: Action[] } {
  let state = createInitialWorld(seed)
  const log: Action[] = []
  let heroIdx = 0
  const SAFETY = 2000
  for (let i = 0; i < SAFETY; i++) {
    const outcome = runOutcome(state)
    if (outcome) {
      const end: Action = { type: 'RunEnd', outcome }
      state = dispatch(state, end); log.push(end)
      break
    }
    const currentId = state.turnOrder[state.turnIndex]
    const actor = state.actors[currentId]
    if (actor && actor.kind === 'hero' && heroIdx < heroActions.length) {
      const a = heroActions[heroIdx++]
      const before = state
      state = dispatch(state, a)
      if (state !== before) log.push(a)
    } else if (actor && actor.kind !== 'hero' && actor.alive) {
      const a = decide(state, currentId)
      const before = state
      state = dispatch(state, a)
      if (state !== before) log.push(a)
    }
    const adv: Action = { type: 'TurnAdvance' }
    state = dispatch(state, adv); log.push(adv)
  }
  return { final: state, log }
}

function replayFromLog(seed: string, log: Action[]): World {
  let state = createInitialWorld(seed)
  for (const a of log) state = dispatch(state, a)
  return state
}

describe('full-run integration', () => {
  it('replays the same log to the same final state', () => {
    const seed = 'integration-1b'
    const { final, log } = simulate(seed, [])
    const replayed = replayFromLog(seed, log)
    expect(replayed.tick).toBe(final.tick)
    expect(replayed.phase).toBe(final.phase)
    for (const id of Object.keys(final.actors)) {
      expect(replayed.actors[id].hp).toBe(final.actors[id].hp)
      expect(replayed.actors[id].alive).toBe(final.actors[id].alive)
      expect(replayed.actors[id].pos).toEqual(final.actors[id].pos)
    }
  })

  it('terminates with an outcome within the safety bound', () => {
    const seed = 'integration-2b'
    const { final } = simulate(seed, [])
    expect(['run_won', 'run_lost']).toContain(final.phase)
  })
})
