import { describe, it, expect } from 'bun:test'
import { resolveHeroAction } from '../../src/ai/heroAuto'
import { createInitialWorld } from '../../src/core/state'

describe('resolveHeroAction', () => {
  it('returns null when hero has no intent and no adjacent threat', () => {
    const w = createInitialWorld('ha-1')
    const action = resolveHeroAction(w)
    expect(action).toBeNull()
  })

  it('auto-attacks an adjacent enemy regardless of intent', () => {
    const base = createInitialWorld('ha-2')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
      heroIntent: { kind: 'move-to' as const, goal: { x: hero.pos.x + 10, y: hero.pos.y } },
    }
    const action = resolveHeroAction(w)
    expect(action).toEqual({ type: 'AttackActor', attackerId: hero.id, targetId: enemyId })
  })

  it('picks lowest-HP adjacent enemy when multiple threats', () => {
    const base = createInitialWorld('ha-3')
    const ids = Object.keys(base.actors).filter(id => id !== base.heroId)
    const a = ids[0], b = ids[1]
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [a]: { ...base.actors[a], pos: { x: hero.pos.x + 1, y: hero.pos.y }, hp: 8 },
        [b]: { ...base.actors[b], pos: { x: hero.pos.x - 1, y: hero.pos.y }, hp: 2 },
      },
    }
    const action = resolveHeroAction(w)
    expect(action).toEqual({ type: 'AttackActor', attackerId: hero.id, targetId: b })
  })

  it('takes a pathfind step when move-to intent set and no threat', () => {
    const w = createInitialWorld('ha-4')
    const hero = w.actors[w.heroId]
    const withIntent = {
      ...w,
      heroIntent: { kind: 'move-to' as const, goal: { x: hero.pos.x + 3, y: hero.pos.y } },
    }
    const action = resolveHeroAction(withIntent)
    expect(action?.type).toBe('MoveActor')
  })

  it('clears move-to intent once the hero reaches the goal', () => {
    const base = createInitialWorld('ha-5')
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      heroIntent: { kind: 'move-to' as const, goal: hero.pos },
    }
    const action = resolveHeroAction(w)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: null })
  })

  it('clears attack intent when the target is dead', () => {
    const base = createInitialWorld('ha-6')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], alive: false, hp: 0 },
      },
      heroIntent: { kind: 'attack' as const, targetId: enemyId },
    }
    const action = resolveHeroAction(w)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: null })
  })

  it('returns null when hero is dead', () => {
    const base = createInitialWorld('ha-7')
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [base.heroId]: { ...base.actors[base.heroId], alive: false, hp: 0 },
      },
    }
    expect(resolveHeroAction(w)).toBeNull()
  })
})
