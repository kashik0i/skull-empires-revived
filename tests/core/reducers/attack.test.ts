import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'
import type { World, Action, StatusEffect } from '../../../src/core/types'

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

  it('hero with buff-atk +2 status deals extra 2 damage vs baseline', () => {
    const base = createInitialWorld('attack-buffatk')
    const { world: w, enemyId } = placeEnemyNextToHero(base)
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }

    // Baseline damage without buff
    const w2baseline = rootReducer(w, action)
    const baselineDamage = w.actors[enemyId].hp - w2baseline.actors[enemyId].hp

    // Apply buff-atk +2 to hero
    const buffEffect: StatusEffect = { kind: 'buff-atk', amount: 2, remainingTicks: 10 }
    const hero = w.actors[w.heroId]
    const wBuffed: World = {
      ...w,
      actors: {
        ...w.actors,
        [w.heroId]: { ...hero, statusEffects: [buffEffect] },
        // reset enemy hp
        [enemyId]: { ...w.actors[enemyId] },
      },
    }
    const w2buffed = rootReducer(wBuffed, action)
    const buffedDamage = wBuffed.actors[enemyId].hp - w2buffed.actors[enemyId].hp

    expect(buffedDamage).toBe(baselineDamage + 2)
  })

  it('enemy with debuff-def -1 takes extra 1 damage from hero', () => {
    const base = createInitialWorld('attack-debuffdef')
    const { world: w, enemyId } = placeEnemyNextToHero(base)
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }

    // Baseline damage without debuff
    const w2baseline = rootReducer(w, action)
    const baselineDamage = w.actors[enemyId].hp - w2baseline.actors[enemyId].hp

    // Apply debuff-def -1 to enemy
    const debuffEffect: StatusEffect = { kind: 'debuff-def', amount: 1, remainingTicks: 10 }
    const enemy = w.actors[enemyId]
    const wDebuffed: World = {
      ...w,
      actors: {
        ...w.actors,
        [enemyId]: { ...enemy, statusEffects: [debuffEffect] },
      },
    }
    const w2debuffed = rootReducer(wDebuffed, action)
    const debuffedDamage = wDebuffed.actors[enemyId].hp - w2debuffed.actors[enemyId].hp

    expect(debuffedDamage).toBe(baselineDamage + 1)
  })

  it('stacking: two buff-atk +1 effects give +2 total damage', () => {
    const base = createInitialWorld('attack-stackbuff')
    const { world: w, enemyId } = placeEnemyNextToHero(base)
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }

    // Baseline
    const w2baseline = rootReducer(w, action)
    const baselineDamage = w.actors[enemyId].hp - w2baseline.actors[enemyId].hp

    // Two buff-atk +1 effects on hero
    const buff1: StatusEffect = { kind: 'buff-atk', amount: 1, remainingTicks: 5 }
    const buff2: StatusEffect = { kind: 'buff-atk', amount: 1, remainingTicks: 5 }
    const hero = w.actors[w.heroId]
    const wStacked: World = {
      ...w,
      actors: {
        ...w.actors,
        [w.heroId]: { ...hero, statusEffects: [buff1, buff2] },
      },
    }
    const w2stacked = rootReducer(wStacked, action)
    const stackedDamage = wStacked.actors[enemyId].hp - w2stacked.actors[enemyId].hp

    expect(stackedDamage).toBe(baselineDamage + 2)
  })
})
