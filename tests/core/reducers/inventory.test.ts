import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import { instantiateItem } from '../../../src/content/itemLoader'
import type { World } from '../../../src/core/types'

function withInventory(seed: string, items: { id: string; instanceId: string }[]): World {
  const base = createInitialWorld(seed)
  return { ...base, inventory: items.map(i => instantiateItem(i.id, i.instanceId)) }
}

describe('inventory reducer', () => {
  it('UseItem heals when potion is heal-small', () => {
    const base = withInventory('inv-1', [{ id: 'heal-small', instanceId: 'p1' }])
    const heroId = base.heroId
    const wounded = { ...base, actors: { ...base.actors, [heroId]: { ...base.actors[heroId], hp: 5 } } }
    const next = dispatch(wounded, { type: 'UseItem', instanceId: 'p1' })
    expect(next.actors[heroId].hp).toBe(10)
    expect(next.inventory.length).toBe(0)
  })

  it('UseItem applies buff-atk for strength-tonic', () => {
    const base = withInventory('inv-2', [{ id: 'strength-tonic', instanceId: 'p2' }])
    const next = dispatch(base, { type: 'UseItem', instanceId: 'p2' })
    const buffs = next.actors[base.heroId].statusEffects.filter(s => s.kind === 'buff-atk')
    expect(buffs.length).toBe(1)
    expect(buffs[0].amount).toBe(2)
  })

  it('EquipItem moves weapon from inventory to equipment.weapon', () => {
    const base = withInventory('inv-3', [{ id: 'iron-blade', instanceId: 'w1' }])
    const next = dispatch(base, { type: 'EquipItem', instanceId: 'w1' })
    expect(next.equipment.weapon?.instanceId).toBe('w1')
    expect(next.inventory.length).toBe(0)
  })

  it('EquipItem swaps with existing equipped item', () => {
    const base = withInventory('inv-4', [{ id: 'iron-blade', instanceId: 'w-new' }])
    const equipped = instantiateItem('rusty-blade', 'w-old')
    const state = { ...base, equipment: { weapon: equipped, armor: null } }
    const next = dispatch(state, { type: 'EquipItem', instanceId: 'w-new' })
    expect(next.equipment.weapon?.instanceId).toBe('w-new')
    expect(next.inventory.find(i => i.instanceId === 'w-old')).toBeDefined()
  })

  it('UnequipItem moves equipment back to inventory', () => {
    const base = createInitialWorld('inv-5')
    const equipped = instantiateItem('iron-blade', 'w1')
    const state = { ...base, equipment: { weapon: equipped, armor: null } }
    const next = dispatch(state, { type: 'UnequipItem', slot: 'weapon' })
    expect(next.equipment.weapon).toBeNull()
    expect(next.inventory.find(i => i.instanceId === 'w1')).toBeDefined()
  })

  it('UnequipItem rejected when inventory is full', () => {
    const base = withInventory('inv-6', [
      { id: 'heal-small', instanceId: 'p1' },
      { id: 'heal-small', instanceId: 'p2' },
      { id: 'heal-small', instanceId: 'p3' },
      { id: 'heal-small', instanceId: 'p4' },
      { id: 'heal-small', instanceId: 'p5' },
      { id: 'heal-small', instanceId: 'p6' },
    ])
    const equipped = instantiateItem('iron-blade', 'w1')
    const state = { ...base, equipment: { weapon: equipped, armor: null } }
    const next = dispatch(state, { type: 'UnequipItem', slot: 'weapon' })
    expect(next.equipment.weapon).not.toBeNull()
  })

  it('PickupItem moves ground item into inventory', () => {
    const base = createInitialWorld('inv-7')
    const state = { ...base, groundItems: [{ instanceId: 'g1', itemId: 'heal-small', pos: { x: 0, y: 0 } }] }
    const next = dispatch(state, { type: 'PickupItem', instanceId: 'g1' })
    expect(next.inventory.length).toBe(1)
    expect(next.groundItems.length).toBe(0)
  })

  it('PickupItem rejected when inventory is full', () => {
    const base = withInventory('inv-8', Array.from({ length: 6 }, (_, i) => ({ id: 'heal-small', instanceId: `p${i}` })))
    const state = { ...base, groundItems: [{ instanceId: 'g1', itemId: 'heal-small', pos: { x: 0, y: 0 } }] }
    const next = dispatch(state, { type: 'PickupItem', instanceId: 'g1' })
    expect(next.inventory.length).toBe(6)
    expect(next.groundItems.length).toBe(1)
  })
})
