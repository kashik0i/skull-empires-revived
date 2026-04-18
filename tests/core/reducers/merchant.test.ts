import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { Actor, World } from '../../../src/core/types'

function withMerchant(seed: string): World {
  const base = createInitialWorld(seed)
  const heroPos = base.actors[base.heroId].pos
  const merchant: Actor = {
    id: 'merchant-d2',
    kind: 'npc',
    archetype: 'merchant',
    pos: { x: heroPos.x + 1, y: heroPos.y },
    hp: 1,
    maxHp: 1,
    atk: 0,
    def: 0,
    alive: true,
    statusEffects: [],
  }
  return {
    ...base,
    actors: { ...base.actors, [merchant.id]: merchant },
    turnOrder: [...base.turnOrder, merchant.id],
  }
}

describe('merchant interaction', () => {
  it('OpenMerchantDialog offers 3 items', () => {
    const state = withMerchant('m-1')
    const next = dispatch(state, { type: 'OpenMerchantDialog', merchantId: 'merchant-d2' })
    expect(next.pendingDialog).not.toBeNull()
    expect(next.pendingDialog!.actions.length).toBe(3)
    for (const act of next.pendingDialog!.actions) {
      expect(act.resolve?.type).toBe('MerchantBuyItem')
    }
  })

  it('MerchantBuyItem adds item to inventory and removes merchant', () => {
    const state = withMerchant('m-2')
    const next = dispatch(state, { type: 'MerchantBuyItem', itemId: 'heal-small', merchantId: 'merchant-d2' })
    expect(next.actors['merchant-d2']).toBeUndefined()
    expect(next.turnOrder.includes('merchant-d2')).toBe(false)
    expect(next.inventory.length).toBe(1)
    expect(next.inventory[0].id).toBe('heal-small')
  })

  it('MerchantBuyItem on full inventory closes dialog without adding', () => {
    const base = withMerchant('m-3')
    // Fill inventory to 6
    const fullInv = Array.from({ length: 6 }, (_, i) => ({
      id: 'heal-small', instanceId: `p${i}`, name: 'x', sprite: 'flask_red',
      body: { kind: 'potion' as const, effect: { type: 'heal' as const, amount: 5 } },
    }))
    const state = { ...base, inventory: fullInv, pendingDialog: { title: 't', body: 'b', actions: [] } }
    const next = dispatch(state, { type: 'MerchantBuyItem', itemId: 'heal-small', merchantId: 'merchant-d2' })
    expect(next.inventory.length).toBe(6)
    expect(next.pendingDialog).toBeNull()
  })

  it('interact click on NPC sets interact intent', async () => {
    const { intentForClick } = await import('../../../src/input/intent')
    const state = withMerchant('m-3')
    const npcPos = state.actors['merchant-d2'].pos
    const action = intentForClick(state, npcPos)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: { kind: 'interact', targetId: 'merchant-d2' } })
  })

  it('hero walking onto merchant tile swaps positions', () => {
    const state = withMerchant('m-5')
    const heroId = state.heroId
    const heroStart = state.actors[heroId].pos
    const merchantStart = state.actors['merchant-d2'].pos
    const next = dispatch(state, { type: 'MoveActor', actorId: heroId, to: merchantStart })
    expect(next.actors[heroId].pos).toEqual(merchantStart)
    expect(next.actors['merchant-d2'].pos).toEqual(heroStart)
  })
})
