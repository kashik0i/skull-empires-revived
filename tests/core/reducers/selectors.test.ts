import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { runOutcome } from '../../../src/core/selectors'

describe('runOutcome', () => {
  it('returns null while enemies and hero are alive', () => {
    const w = createInitialWorld('out-1')
    expect(runOutcome(w)).toBeNull()
  })

  it("returns 'lost' when hero is dead", () => {
    const base = createInitialWorld('out-2')
    const w = { ...base, actors: { ...base.actors, [base.heroId]: { ...base.actors[base.heroId], alive: false, hp: 0 } } }
    expect(runOutcome(w)).toBe('lost')
  })

  it("returns 'won' when all enemies are dead", () => {
    const base = createInitialWorld('out-3')
    const actors = { ...base.actors }
    for (const id of Object.keys(actors)) {
      if (actors[id].kind === 'enemy') actors[id] = { ...actors[id], alive: false, hp: 0 }
    }
    const w = { ...base, actors }
    expect(runOutcome(w)).toBe('won')
  })
})
