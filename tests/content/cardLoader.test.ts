import { describe, it, expect } from 'bun:test'
import { getCard, listCardIds, type CardDef } from '../../src/content/cardLoader'

describe('cardLoader', () => {
  it('getCard("bless") returns a well-formed CardDef', () => {
    const c: CardDef = getCard('bless')
    expect(c.id).toBe('bless')
    expect(typeof c.name).toBe('string')
    expect(c.name.length).toBeGreaterThan(0)
    expect(typeof c.description).toBe('string')
    expect(['self', 'enemy', 'none']).toContain(c.target)
    expect(c.effect).toBeDefined()
    expect(c.effect.kind).toBe('buff-atk')
    if (c.effect.kind === 'buff-atk') {
      expect(c.effect.amount).toBeGreaterThan(0)
      expect(c.effect.durationTicks).toBeGreaterThan(0)
    }
  })

  it('listCardIds() returns exactly the 9 expected ids', () => {
    const ids = listCardIds()
    expect(ids.length).toBe(9)
    expect(ids.slice().sort()).toEqual(
      ['bless', 'curse', 'fortify', 'greater-heal', 'heal', 'reveal-map', 'smite', 'storm', 'vigor'],
    )
  })

  it('throws on unknown id', () => {
    expect(() => getCard('nonexistent')).toThrow(/unknown card/i)
  })

  it('every listed id resolves to a valid CardDef', () => {
    for (const id of listCardIds()) {
      const c = getCard(id)
      expect(c.id).toBe(id)
      expect(['self', 'enemy', 'none']).toContain(c.target)
      expect(typeof c.effect.kind).toBe('string')
    }
  })
})
