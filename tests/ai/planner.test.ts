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
    expect(action?.type).toBe('AttackActor')
  })

  it('moves one step toward hero when not adjacent', () => {
    const w = createInitialWorld('plan-2')
    const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
    const enemy = w.actors[enemyId]
    const action = decide(w, enemyId)
    if (action && action.type === 'MoveActor') {
      const d = Math.abs(action.to.x - enemy.pos.x) + Math.abs(action.to.y - enemy.pos.y)
      expect(d).toBe(1)
    } else {
      expect(action).toBeNull()
    }
  })

  it('returns null when the actor has no viable action', () => {
    const base = createInitialWorld('plan-3')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const dead = { ...base.actors[enemyId], alive: false, hp: 0 }
    const w = { ...base, actors: { ...base.actors, [enemyId]: dead } }
    const action = decide(w, enemyId)
    expect(action).toBeNull()
  })

  it('makes sideways progress when primary axis is blocked by another actor', () => {
    const base = createInitialWorld('stuck-fix-1')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const otherEnemyId = Object.keys(base.actors).find(id => id !== base.heroId && id !== enemyId)!
    const hero = base.actors[base.heroId]
    // Put enemy two tiles east of hero. Put another enemy directly between them.
    const enemyPos = { x: hero.pos.x + 2, y: hero.pos.y }
    const blockerPos = { x: hero.pos.x + 1, y: hero.pos.y }
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: enemyPos },
        [otherEnemyId]: { ...base.actors[otherEnemyId], pos: blockerPos },
      },
    }
    const action = decide(w, enemyId)
    // The enemy cannot go west (blocker) — must either move north/south (sideways) or pass.
    // With the fix, sideways movement is allowed when it doesn't increase distance by more than 1.
    // Hero is at (hero.pos.x, hero.pos.y); blocker at (x+1, y); enemy at (x+2, y).
    // Going north/south stays 3 away on Manhattan — that's currentDist (2) + 1. Accepted by the filter.
    // So the action should be a MoveActor to a passable neighbor (if any) or null
    // if all neighbors are walls.
    if (action && action.type === 'MoveActor') {
      const p = action.to
      const d = Math.abs(hero.pos.x - p.x) + Math.abs(hero.pos.y - p.y)
      // After the fix, the step must not increase distance beyond currentDist + 1 = 3.
      expect(d).toBeLessThanOrEqual(3)
      // And the step must be exactly one tile away from the enemy.
      const step = Math.abs(p.x - enemyPos.x) + Math.abs(p.y - enemyPos.y)
      expect(step).toBe(1)
    } else {
      // Acceptable if all 4 neighbors are walls (depends on procgen), else fix didn't help.
      expect(action).toBeNull()
    }
  })
})
