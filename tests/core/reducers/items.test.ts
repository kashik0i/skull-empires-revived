import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { World } from '../../../src/core/types'

describe('item drops', () => {
  it('enemy stepping onto a ground item does NOT pick it up', () => {
    const base = createInitialWorld('item-enemy-nopick')
    const enemy = Object.values(base.actors).find(a => a.kind === 'enemy')!
    const dropPos = { x: enemy.pos.x + 1, y: enemy.pos.y }
    const tile = base.floor.tiles[dropPos.y * base.floor.width + dropPos.x]
    if (tile !== 1) return // skip if not walkable; don't fight procgen
    const state: World = {
      ...base,
      groundItems: [{ instanceId: 'g1', itemId: 'heal-small', pos: dropPos }],
    }
    const next = dispatch(state, { type: 'MoveActor', actorId: enemy.id, to: dropPos })
    expect(next.groundItems.length).toBe(1)
    expect(next.actors[enemy.id].hp).toBe(enemy.hp)
  })
})
