import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'
import type { HeroIntent } from '../../../src/core/types'

describe('SetHeroIntent reducer', () => {
  it('initial state has heroIntent null', () => {
    const w = createInitialWorld('int-1')
    expect(w.heroIntent).toBeNull()
  })

  it('sets a move-to intent', () => {
    const w = createInitialWorld('int-2')
    const intent: HeroIntent = { kind: 'move-to', goal: { x: 5, y: 5 } }
    const w2 = rootReducer(w, { type: 'SetHeroIntent', intent })
    expect(w2.heroIntent).toEqual(intent)
  })

  it('sets an attack intent', () => {
    const w = createInitialWorld('int-3')
    const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
    const intent: HeroIntent = { kind: 'attack', targetId: enemyId }
    const w2 = rootReducer(w, { type: 'SetHeroIntent', intent })
    expect(w2.heroIntent).toEqual(intent)
  })

  it('clears the intent when intent is null', () => {
    const w = createInitialWorld('int-4')
    const w2 = rootReducer(w, { type: 'SetHeroIntent', intent: { kind: 'move-to', goal: { x: 1, y: 1 } } })
    const w3 = rootReducer(w2, { type: 'SetHeroIntent', intent: null })
    expect(w3.heroIntent).toBeNull()
  })

  it('returns same state when intent reference is unchanged', () => {
    const w = createInitialWorld('int-5')
    const w2 = rootReducer(w, { type: 'SetHeroIntent', intent: null })
    expect(w2).toBe(w)
  })
})
