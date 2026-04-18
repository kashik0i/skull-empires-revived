import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { effectiveAtk, effectiveDef } from '../../src/core/selectors'
import { instantiateItem } from '../../src/content/itemLoader'

describe('effective stats', () => {
  it('returns base atk/def with no equipment + no buffs', () => {
    const w = createInitialWorld('eff-1')
    const hero = w.actors[w.heroId]
    expect(effectiveAtk(w, w.heroId)).toBe(hero.atk)
    expect(effectiveDef(w, w.heroId)).toBe(hero.def)
  })

  it('adds weapon atk to hero when equipped', () => {
    const base = createInitialWorld('eff-2')
    const w = { ...base, equipment: { weapon: instantiateItem('iron-blade', 'w1'), armor: null } }
    expect(effectiveAtk(w, w.heroId)).toBe(base.actors[base.heroId].atk + 2)
  })

  it('adds armor def to hero when equipped', () => {
    const base = createInitialWorld('eff-3')
    const w = { ...base, equipment: { weapon: null, armor: instantiateItem('plate-mail', 'a1') } }
    expect(effectiveDef(w, w.heroId)).toBe(base.actors[base.heroId].def + 3)
  })

  it('adds buff-atk status', () => {
    const base = createInitialWorld('eff-4')
    const hero = base.actors[base.heroId]
    const buffed = { ...hero, statusEffects: [{ kind: 'buff-atk' as const, amount: 3, remainingTicks: 2 }] }
    const w = { ...base, actors: { ...base.actors, [base.heroId]: buffed } }
    expect(effectiveAtk(w, w.heroId)).toBe(hero.atk + 3)
  })

  it('does not add hero equipment to enemies', () => {
    const base = createInitialWorld('eff-5')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const w = { ...base, equipment: { weapon: instantiateItem('ember-blade', 'w2'), armor: null } }
    expect(effectiveAtk(w, enemyId)).toBe(base.actors[enemyId].atk)
  })
})
