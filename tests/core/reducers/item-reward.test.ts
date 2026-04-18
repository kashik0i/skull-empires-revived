import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { World } from '../../../src/core/types'

describe('item reward', () => {
  it('OfferItemReward sets pendingItemReward', () => {
    const base = createInitialWorld('ir-1')
    const next = dispatch(base, { type: 'OfferItemReward', itemIds: ['heal-small', 'rusty-blade', 'cloth-rags'] })
    expect(next.run.pendingItemReward).toEqual(['heal-small', 'rusty-blade', 'cloth-rags'])
  })

  it('PickItemReward adds to inventory and clears reward', () => {
    const base = createInitialWorld('ir-2')
    const offered: World = { ...base, run: { ...base.run, pendingItemReward: ['heal-small', 'rusty-blade'] } }
    const next = dispatch(offered, { type: 'PickItemReward', itemId: 'heal-small' })
    expect(next.inventory.length).toBe(1)
    expect(next.inventory[0].id).toBe('heal-small')
    expect(next.run.pendingItemReward).toBeNull()
    expect(next.run.rewardedThisFloor).toBe(true)
  })

  it('PickItemReward on full inventory clears reward without adding', () => {
    const base = createInitialWorld('ir-3')
    const fullInv = Array.from({ length: 6 }, (_, i) => ({
      id: 'heal-small', instanceId: `p${i}`, name: 'x', sprite: 'flask_red',
      body: { kind: 'potion' as const, effect: { type: 'heal' as const, amount: 5 } },
    }))
    const offered: World = {
      ...base,
      inventory: fullInv,
      run: { ...base.run, pendingItemReward: ['heal-small'] },
    }
    const next = dispatch(offered, { type: 'PickItemReward', itemId: 'heal-small' })
    expect(next.inventory.length).toBe(6)
    expect(next.run.pendingItemReward).toBeNull()
    expect(next.run.rewardedThisFloor).toBe(true)
  })

  it('PickItemReward rejects unknown item id', () => {
    const base = createInitialWorld('ir-4')
    const offered: World = { ...base, run: { ...base.run, pendingItemReward: ['heal-small'] } }
    const next = dispatch(offered, { type: 'PickItemReward', itemId: 'not-offered' })
    expect(next.run.pendingItemReward).toEqual(['heal-small'])
  })
})
