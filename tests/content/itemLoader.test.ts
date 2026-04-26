import { describe, it, expect } from 'bun:test'
import { getItemDef, listItemIds, instantiateItem, itemPoolForDepth } from '../../src/content/itemLoader'

describe('itemLoader', () => {
  it('lists exactly 15 items', () => {
    expect(listItemIds().length).toBe(15)
  })

  it('throws on unknown id', () => {
    expect(() => getItemDef('does-not-exist')).toThrow()
  })

  it('instantiates with given instanceId', () => {
    const it = instantiateItem('heal-small', 'inst-1')
    expect(it.instanceId).toBe('inst-1')
    expect(it.id).toBe('heal-small')
    expect(it.body.kind).toBe('potion')
  })

  it('depth pool grows with depth', () => {
    expect(itemPoolForDepth(1).length).toBe(3)
    expect(itemPoolForDepth(3).length).toBe(9)
    expect(itemPoolForDepth(5).length).toBe(15)
  })
})
