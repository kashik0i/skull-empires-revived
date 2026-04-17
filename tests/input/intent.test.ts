import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { intentForClick } from '../../src/input/intent'

describe('intentForClick', () => {
  it('returns MoveActor toward an empty adjacent tile', () => {
    const w = createInitialWorld('i-1')
    const hero = w.actors[w.heroId]
    const action = intentForClick(w, { x: hero.pos.x + 1, y: hero.pos.y })
    expect(action?.type).toBe('MoveActor')
  })

  it('returns AttackActor when clicking an adjacent enemy', () => {
    const base = createInitialWorld('i-2')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    }
    const enemy = w.actors[enemyId]
    const action = intentForClick(w, enemy.pos)
    expect(action).toEqual({ type: 'AttackActor', attackerId: w.heroId, targetId: enemyId })
  })

  it('returns null for a click on a non-adjacent tile', () => {
    const w = createInitialWorld('i-3')
    const hero = w.actors[w.heroId]
    const action = intentForClick(w, { x: hero.pos.x + 4, y: hero.pos.y })
    expect(action).toBeNull()
  })
})
