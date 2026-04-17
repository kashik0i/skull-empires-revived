import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'
import type { World, Action } from '../../../src/core/types'

function placeEnemyNextToHero(w: World): { world: World; enemyId: string } {
  const hero = w.actors[w.heroId]
  const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
  const enemy = w.actors[enemyId]
  return {
    world: {
      ...w,
      actors: {
        ...w.actors,
        [enemyId]: { ...enemy, pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    },
    enemyId,
  }
}

describe('AttackActor reducer', () => {
  it('reduces target hp by max(1, atk - def)', () => {
    const base = createInitialWorld('attack-1')
    const { world: w, enemyId } = placeEnemyNextToHero(base)
    const beforeHp = w.actors[enemyId].hp
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }
    const w2 = rootReducer(w, action)
    const dmg = Math.max(1, w.actors[w.heroId].atk - w.actors[enemyId].def)
    expect(w2.actors[enemyId].hp).toBe(beforeHp - dmg)
  })

  it('marks target as dead at hp <= 0', () => {
    const base = createInitialWorld('attack-2')
    const { world, enemyId } = placeEnemyNextToHero(base)
    const w = { ...world, actors: { ...world.actors, [enemyId]: { ...world.actors[enemyId], hp: 1 } } }
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }
    const w2 = rootReducer(w, action)
    expect(w2.actors[enemyId].hp).toBeLessThanOrEqual(0)
    expect(w2.actors[enemyId].alive).toBe(false)
  })

  it('refuses if target is not adjacent', () => {
    const w = createInitialWorld('attack-3')
    const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }
    const w2 = rootReducer(w, action)
    expect(w2).toBe(w)
  })
})
