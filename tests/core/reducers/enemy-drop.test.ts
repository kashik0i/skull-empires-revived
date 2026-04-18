import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { World } from '../../../src/core/types'

describe('enemy drop on death', () => {
  it('drops are deterministic per seed', () => {
    const seed = 'drop-1'
    function buildAndKill(): World {
      const base = createInitialWorld(seed)
      const heroId = base.heroId
      const enemyId = Object.keys(base.actors).find(id => id !== heroId)!
      const wounded = { ...base, actors: { ...base.actors, [enemyId]: { ...base.actors[enemyId], hp: 1 } } }
      // Position them adjacent
      const heroPos = wounded.actors[heroId].pos
      const positioned = { ...wounded, actors: { ...wounded.actors, [enemyId]: { ...wounded.actors[enemyId], pos: { x: heroPos.x + 1, y: heroPos.y } } } }
      return dispatch(positioned, { type: 'AttackActor', attackerId: heroId, targetId: enemyId })
    }
    const a = buildAndKill()
    const b = buildAndKill()
    expect(a.groundItems).toEqual(b.groundItems)
  })

  it('drop rate is approximately 25% across 200 deterministic kills', () => {
    let drops = 0
    const N = 200
    for (let i = 0; i < N; i++) {
      const base = createInitialWorld(`drop-${i}`)
      const heroId = base.heroId
      const enemyId = Object.keys(base.actors).find(id => id !== heroId)!
      const heroPos = base.actors[heroId].pos
      const state: World = {
        ...base,
        actors: {
          ...base.actors,
          [enemyId]: { ...base.actors[enemyId], hp: 1, pos: { x: heroPos.x + 1, y: heroPos.y } },
        },
      }
      const next = dispatch(state, { type: 'AttackActor', attackerId: heroId, targetId: enemyId })
      if (next.groundItems.length > base.groundItems.length) drops++
    }
    expect(drops).toBeGreaterThan(N * 0.15)
    expect(drops).toBeLessThan(N * 0.35)
  })

  it('non-hero kills do not drop items', () => {
    // If an enemy somehow killed another enemy (rare), no drop should happen
    const base = createInitialWorld('drop-2')
    const ids = Object.keys(base.actors).filter(id => id !== base.heroId)
    if (ids.length < 2) return // skip if not enough enemies
    const a = ids[0], b = ids[1]
    const heroPos = base.actors[base.heroId].pos
    const state: World = {
      ...base,
      actors: {
        ...base.actors,
        [a]: { ...base.actors[a], pos: { x: heroPos.x + 5, y: heroPos.y } },
        [b]: { ...base.actors[b], pos: { x: heroPos.x + 6, y: heroPos.y }, hp: 1 },
      },
    }
    const before = state.groundItems.length
    const next = dispatch(state, { type: 'AttackActor', attackerId: a, targetId: b })
    expect(next.groundItems.length).toBe(before)
  })
})
