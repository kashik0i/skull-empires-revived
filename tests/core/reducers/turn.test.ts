import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'
import type { StatusEffect } from '../../../src/core/types'

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

  it('initializes actors with empty statusEffects', () => {
    const w = createInitialWorld('status-init')
    for (const id of Object.keys(w.actors)) {
      expect(w.actors[id].statusEffects).toEqual([])
    }
  })

  it('decrements remainingTicks on each TurnAdvance and purges when <= 0', () => {
    const base = createInitialWorld('status-decrement')
    const heroId = base.heroId
    const effect: StatusEffect = { kind: 'buff-atk', amount: 2, remainingTicks: 3 }
    const w0 = {
      ...base,
      actors: { ...base.actors, [heroId]: { ...base.actors[heroId], statusEffects: [effect] } },
    }

    const w1 = rootReducer(w0, { type: 'TurnAdvance' })
    expect(w1.actors[heroId].statusEffects).toEqual([
      { kind: 'buff-atk', amount: 2, remainingTicks: 2 },
    ])

    const w2 = rootReducer(w1, { type: 'TurnAdvance' })
    expect(w2.actors[heroId].statusEffects).toEqual([
      { kind: 'buff-atk', amount: 2, remainingTicks: 1 },
    ])

    const w3 = rootReducer(w2, { type: 'TurnAdvance' })
    expect(w3.actors[heroId].statusEffects).toEqual([])
  })

  it('does not mutate the input state', () => {
    const base = createInitialWorld('status-immutable')
    const heroId = base.heroId
    const effect: StatusEffect = { kind: 'buff-atk', amount: 2, remainingTicks: 3 }
    const w0 = {
      ...base,
      actors: { ...base.actors, [heroId]: { ...base.actors[heroId], statusEffects: [effect] } },
    }
    const snapshot = w0.actors[heroId].statusEffects
    rootReducer(w0, { type: 'TurnAdvance' })
    expect(snapshot).toEqual([{ kind: 'buff-atk', amount: 2, remainingTicks: 3 }])
    expect(w0.actors[heroId].statusEffects).toBe(snapshot)
  })

  it('decrements multiple effects on the same actor independently', () => {
    const base = createInitialWorld('status-stack')
    const heroId = base.heroId
    const effects: StatusEffect[] = [
      { kind: 'buff-atk', amount: 2, remainingTicks: 5 },
      { kind: 'debuff-def', amount: 1, remainingTicks: 1 },
      { kind: 'buff-def', amount: 3, remainingTicks: 2 },
    ]
    const w0 = {
      ...base,
      actors: { ...base.actors, [heroId]: { ...base.actors[heroId], statusEffects: effects } },
    }
    const w1 = rootReducer(w0, { type: 'TurnAdvance' })
    expect(w1.actors[heroId].statusEffects).toEqual([
      { kind: 'buff-atk', amount: 2, remainingTicks: 4 },
      { kind: 'buff-def', amount: 3, remainingTicks: 1 },
    ])
  })

  it('decrements effects on different actors independently', () => {
    const base = createInitialWorld('status-multi-actor')
    const heroId = base.heroId
    const enemyId = base.turnOrder.find((id) => id !== heroId)!
    const heroEffects: StatusEffect[] = [{ kind: 'buff-atk', amount: 2, remainingTicks: 2 }]
    const enemyEffects: StatusEffect[] = [{ kind: 'debuff-def', amount: 1, remainingTicks: 1 }]
    const w0 = {
      ...base,
      actors: {
        ...base.actors,
        [heroId]: { ...base.actors[heroId], statusEffects: heroEffects },
        [enemyId]: { ...base.actors[enemyId], statusEffects: enemyEffects },
      },
    }
    const w1 = rootReducer(w0, { type: 'TurnAdvance' })
    expect(w1.actors[heroId].statusEffects).toEqual([
      { kind: 'buff-atk', amount: 2, remainingTicks: 1 },
    ])
    expect(w1.actors[enemyId].statusEffects).toEqual([])
  })
})
