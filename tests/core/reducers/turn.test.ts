import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'

describe('TurnAdvance reducer', () => {
  it('advances turnIndex, wraps, and bumps tick', () => {
    const w = createInitialWorld('turn-1')
    const len = w.turnOrder.length
    const w2 = rootReducer(w, { type: 'TurnAdvance' })
    expect(w2.turnIndex).toBe(1 % len)
    expect(w2.tick).toBe(w.tick + 1)
  })

  it('skips dead actors', () => {
    const base = createInitialWorld('turn-2')
    const deadId = base.turnOrder[1]
    const w = { ...base, actors: { ...base.actors, [deadId]: { ...base.actors[deadId], alive: false, hp: 0 } } }
    const w2 = rootReducer(w, { type: 'TurnAdvance' })
    expect(w2.turnIndex).toBe(2 % w.turnOrder.length)
  })
})
