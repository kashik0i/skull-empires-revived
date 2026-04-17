import { describe, it, expect } from 'bun:test'
import { createRng } from '../../src/core/rng'
import { generateBsp } from '../../src/procgen/bsp'

describe('bsp generator', () => {
  it('produces >= 3 rooms for a 40x30 floor', () => {
    const { rooms } = generateBsp(createRng('bsp-1'), 40, 30)
    expect(rooms.length).toBeGreaterThanOrEqual(3)
    for (const r of rooms) {
      expect(r.w).toBeGreaterThanOrEqual(3)
      expect(r.h).toBeGreaterThanOrEqual(3)
      expect(r.x + r.w).toBeLessThanOrEqual(40)
      expect(r.y + r.h).toBeLessThanOrEqual(30)
    }
  })

  it('produces corridors connecting every pair of rooms transitively', () => {
    const { rooms, corridors } = generateBsp(createRng('bsp-2'), 40, 30)
    const nodes = rooms.map((_, i) => i)
    const parent = nodes.slice()
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    const union = (a: number, b: number) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb }
    for (const c of corridors) union(c.fromRoom, c.toRoom)
    const roots = new Set(nodes.map(find))
    expect(roots.size).toBe(1)
  })

  it('is deterministic for the same seed', () => {
    const a = generateBsp(createRng('seed-x'), 40, 30)
    const b = generateBsp(createRng('seed-x'), 40, 30)
    expect(a).toEqual(b)
  })
})
