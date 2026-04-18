import { describe, it, expect } from 'bun:test'
import { getLoreFragment, loreCount } from '../../src/content/loreLoader'

describe('loreLoader', () => {
  it('has exactly 4 fragments', () => {
    expect(loreCount()).toBe(4)
  })

  it('returns well-formed fragments for indices 0..3', () => {
    for (let i = 0; i < 4; i++) {
      const f = getLoreFragment(i)
      expect(f.id).toBe(i)
      expect(f.title.length).toBeGreaterThan(0)
      expect(f.body.length).toBeGreaterThan(0)
    }
  })

  it('throws on unknown index', () => {
    expect(() => getLoreFragment(9)).toThrow()
  })
})
