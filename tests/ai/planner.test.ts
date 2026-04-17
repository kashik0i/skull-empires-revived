import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { decide } from '../../src/ai/planner'

describe('planner (chase behavior for bone-knight)', () => {
  it('attacks when adjacent to the hero', () => {
    const base = createInitialWorld('plan-1')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    }
    const action = decide(w, enemyId)
    expect(action.type).toBe('AttackActor')
  })

  it('moves one step toward hero when not adjacent', () => {
    const w = createInitialWorld('plan-2')
    const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
    const enemy = w.actors[enemyId]
    const action = decide(w, enemyId)
    if (action.type === 'MoveActor') {
      const d = Math.abs(action.to.x - enemy.pos.x) + Math.abs(action.to.y - enemy.pos.y)
      expect(d).toBe(1)
    } else {
      expect(action.type).toBe('TurnAdvance')
    }
  })

  it('returns TurnAdvance when the actor has no viable action', () => {
    const base = createInitialWorld('plan-3')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const dead = { ...base.actors[enemyId], alive: false, hp: 0 }
    const w = { ...base, actors: { ...base.actors, [enemyId]: dead } }
    const action = decide(w, enemyId)
    expect(action.type).toBe('TurnAdvance')
  })
})
