import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { dispatch } from '../../src/core/dispatch'
import { replay } from '../../src/persistence/replay'
import type { Action } from '../../src/core/types'

describe('replay', () => {
  it('reproduces the final state of a recorded run', () => {
    const seed = 'replay-1'
    let w = createInitialWorld(seed)
    const log: Action[] = []
    const hero = w.actors[w.heroId]
    const move: Action = { type: 'MoveActor', actorId: w.heroId, to: { x: hero.pos.x + 1, y: hero.pos.y } }
    const before = w
    w = dispatch(w, move)
    if (w !== before) log.push(move)
    const advance: Action = { type: 'TurnAdvance' }
    w = dispatch(w, advance); log.push(advance)
    const replayed = replay(seed, log)
    expect(replayed.actors[replayed.heroId].pos).toEqual(w.actors[replayed.heroId].pos)
    expect(replayed.tick).toBe(w.tick)
  })
})
