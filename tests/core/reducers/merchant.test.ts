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
  it('OpenMerchantDialog sets pendingDialog with 3 card choices', () => {
    const state = withMerchant('m-1')
    const next = dispatch(state, { type: 'OpenMerchantDialog', merchantId: 'merchant-d2' })
    expect(next.pendingDialog).not.toBeNull()
    expect(next.pendingDialog!.actions.length).toBe(3)
  })

  it('MerchantTrade adds card to deck and removes merchant', () => {
    const state = withMerchant('m-2')
    const before = state.run.cards.deck.length
    const next = dispatch(state, { type: 'MerchantTrade', cardId: 'heal', merchantId: 'merchant-d2' })
    expect(next.actors['merchant-d2']).toBeUndefined()
    expect(next.turnOrder.includes('merchant-d2')).toBe(false)
    expect(next.run.cards.deck.length).toBe(before + 1)
    expect(next.run.cards.deck[next.run.cards.deck.length - 1]).toBe('heal')
  })

  it('interact click on NPC sets interact intent', async () => {
    const { intentForClick } = await import('../../../src/input/intent')
    const state = withMerchant('m-3')
    const npcPos = state.actors['merchant-d2'].pos
    const action = intentForClick(state, npcPos)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: { kind: 'interact', targetId: 'merchant-d2' } })
  })
})
