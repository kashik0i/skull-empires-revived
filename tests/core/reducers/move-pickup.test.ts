import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { World } from '../../../src/core/types'

describe('move pickup', () => {
  it('hero stepping on a ground item moves it into inventory', () => {
    const base = createInitialWorld('mp-1')
    const heroId = base.heroId
    const hero = base.actors[heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    const state: World = {
      ...base,
      groundItems: [{ instanceId: 'g1', itemId: 'heal-small', pos: target }],
    }
    const next = dispatch(state, { type: 'MoveActor', actorId: heroId, to: target })
    expect(next.actors[heroId].pos).toEqual(target)
    expect(next.inventory.length).toBe(1)
    expect(next.inventory[0].instanceId).toBe('g1')
    expect(next.groundItems.length).toBe(0)
  })

  it('full inventory leaves item on ground', () => {
    const base = createInitialWorld('mp-2')
    const heroId = base.heroId
    const hero = base.actors[heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    // Manually set 6 inventory items
    const fullInv = Array.from({ length: 6 }, (_, i) => ({
      id: 'heal-small', instanceId: `p${i}`, name: 'x', sprite: 'flask_red',
      body: { kind: 'potion' as const, effect: { type: 'heal' as const, amount: 5 } },
    }))
    const state: World = {
      ...base,
      inventory: fullInv,
      groundItems: [{ instanceId: 'g1', itemId: 'heal-small', pos: target }],
    }
    const next = dispatch(state, { type: 'MoveActor', actorId: heroId, to: target })
    expect(next.actors[heroId].pos).toEqual(target)
    expect(next.inventory.length).toBe(6)
    expect(next.groundItems.length).toBe(1)
  })
})
