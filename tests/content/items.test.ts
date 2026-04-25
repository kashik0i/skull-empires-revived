import { describe, it, expect } from 'bun:test'
import { getItemDef, itemPoolForDepth, listItemIds } from '../../src/content/itemLoader'

describe('items.json expansion', () => {
  it('contains the five new weapons', () => {
    const ids = listItemIds()
    for (const id of ['knight-blade', 'duel-blade', 'flame-blade', 'golden-blade', 'royal-blade']) {
      expect(ids).toContain(id)
    }
  })

  it('new weapons have correct atk values', () => {
    expect((getItemDef('knight-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(3)
    expect((getItemDef('duel-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(3)
    expect((getItemDef('flame-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(4)
    expect((getItemDef('golden-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(4)
    expect((getItemDef('royal-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(5)
  })

  it('depth pools are tiered (commons → mids → highs)', () => {
    const d1 = itemPoolForDepth(1)
    const d3 = itemPoolForDepth(3)
    const d5 = itemPoolForDepth(5)
    expect(d3.length).toBeGreaterThan(d1.length)
    expect(d5.length).toBeGreaterThan(d3.length)
    expect(d5).toContain('royal-blade')
    expect(d5).toContain('golden-blade')
    expect(d3).toContain('knight-blade')
  })

  it('existing item stats unchanged (regression)', () => {
    expect((getItemDef('rusty-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(1)
    expect((getItemDef('iron-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(2)
    expect((getItemDef('ember-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(3)
  })
})
