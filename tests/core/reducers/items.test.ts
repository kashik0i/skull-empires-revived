import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { Actor, World } from '../../../src/core/types'

describe('item drops', () => {
  it('enemy stepping onto an item does NOT pick it up', () => {
    const base = createInitialWorld('item-enemy-nopick')
    // Find an enemy with a walkable neighbor.
    const enemy = Object.values(base.actors).find(a => a.kind === 'enemy')!
    const dropPos = { x: enemy.pos.x + 1, y: enemy.pos.y }
    // Skip if not walkable — don't want to fight the procgen
    const tile = base.floor.tiles[dropPos.y * base.floor.width + dropPos.x]
    if (tile !== 1) return
    const state: World = {
      ...base,
      droppedItems: [{ id: 'd', kind: 'flask-red', pos: dropPos }],
    }
    const next = dispatch(state, { type: 'MoveActor', actorId: enemy.id, to: dropPos })
    // Item stays on the ground
    expect(next.droppedItems.length).toBe(1)
    // Enemy's stats don't mutate
    expect(next.actors[enemy.id].hp).toBe(enemy.hp)
  })

  it('killing a non-boss enemy may push an item onto the drop list (deterministic by seed)', () => {
    // Check *at least one of many seeds* produces a drop, since 40% chance is probabilistic.
    let dropsSeen = 0
    for (let s = 0; s < 50; s++) {
      const base = createInitialWorld(`drop-seed-${s}`)
      const hero = base.actors[base.heroId]
      const enemy: Actor = {
        id: 'test-enemy',
        kind: 'enemy',
        archetype: 'tiny-zombie',
        pos: { x: hero.pos.x + 1, y: hero.pos.y },
        hp: 1, maxHp: 1, atk: 1, def: 0,
        alive: true,
        statusEffects: [],
      }
      const state: World = { ...base, actors: { ...base.actors, [enemy.id]: enemy } }
      const next = dispatch(state, { type: 'AttackActor', attackerId: hero.id, targetId: enemy.id })
      if (next.droppedItems.length > state.droppedItems.length) dropsSeen++
    }
    // Expect some drops across 50 trials at 40% chance
    expect(dropsSeen).toBeGreaterThan(5)
  })

  it('boss kill does NOT drop loot', () => {
    const base = createInitialWorld('boss-nodrop')
    const heroPos = base.actors[base.heroId].pos
    const boss: Actor = {
      id: 'test-boss',
      kind: 'enemy',
      archetype: 'skull-emperor',
      pos: { x: heroPos.x + 1, y: heroPos.y },
      hp: 1, maxHp: 30, atk: 1, def: 0,
      alive: true,
      statusEffects: [],
    }
    const state: World = { ...base, actors: { ...base.actors, [boss.id]: boss } }
    const next = dispatch(state, { type: 'AttackActor', attackerId: base.heroId, targetId: boss.id })
    expect(next.droppedItems.length).toBe(0)
  })
})
