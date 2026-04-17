import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'

describe('MoveActor reducer', () => {
  it('moves the hero to an adjacent walkable tile', () => {
    const w = createInitialWorld('move-1')
    const hero = w.actors[w.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: target })
    expect(w2.actors[w.heroId].pos).toEqual(target)
  })

  it('refuses to move onto a wall', () => {
    const w = createInitialWorld('move-2')
    const hero = w.actors[w.heroId]
    const blocked = { x: -1, y: hero.pos.y }
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: blocked })
    expect(w2).toBe(w)
  })

  it('refuses to move onto a tile occupied by another actor', () => {
    const w = createInitialWorld('move-3')
    const enemy = Object.values(w.actors).find(a => a.kind === 'enemy')!
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: enemy.pos })
    expect(w2).toBe(w)
  })

  it('refuses to move more than one tile away (orthogonal)', () => {
    const w = createInitialWorld('move-4')
    const hero = w.actors[w.heroId]
    const far = { x: hero.pos.x + 3, y: hero.pos.y }
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: far })
    expect(w2).toBe(w)
  })
})
