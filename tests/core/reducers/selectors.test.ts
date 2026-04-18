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

  it("returns 'won' when all enemies are dead on the boss floor", () => {
    const base = createInitialWorld('out-3')
    const actors = { ...base.actors }
    for (const id of Object.keys(actors)) {
      if (actors[id].kind === 'enemy') actors[id] = { ...actors[id], alive: false, hp: 0 }
    }
    const w = { ...base, actors, run: { ...base.run, depth: 5 } }
    expect(runOutcome(w)).toBe('won')
  })

  it('returns null when enemies are dead on a non-boss floor (card reward pending)', () => {
    const base = createInitialWorld('out-4')
    const actors = { ...base.actors }
    for (const id of Object.keys(actors)) {
      if (actors[id].kind === 'enemy') actors[id] = { ...actors[id], alive: false, hp: 0 }
    }
    const w = { ...base, actors, run: { ...base.run, depth: 1 } }
    expect(runOutcome(w)).toBeNull()
  })
})
