import { describe, it, expect } from 'bun:test'
import { createRng, nextU32, nextFloat, nextInt, type RngState } from '../../src/core/rng'

describe('rng (sfc32)', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('seed-one')
    const b = createRng('seed-one')
    const seqA: number[] = []
    const seqB: number[] = []
    let sa: RngState = a, sb: RngState = b
    for (let i = 0; i < 20; i++) {
      const ra = nextU32(sa); seqA.push(ra.value); sa = ra.state
      const rb = nextU32(sb); seqB.push(rb.value); sb = rb.state
    }
    expect(seqA).toEqual(seqB)
  })

  it('diverges on different seeds', () => {
    const a = createRng('seed-one')
    const b = createRng('seed-two')
    const ra = nextU32(a)
    const rb = nextU32(b)
    expect(ra.value).not.toBe(rb.value)
  })

  it('nextInt returns values in [min, max)', () => {
    let s = createRng('range')
    for (let i = 0; i < 1000; i++) {
      const r = nextInt(s, 3, 9)
      expect(r.value).toBeGreaterThanOrEqual(3)
      expect(r.value).toBeLessThan(9)
      s = r.state
    }
  })

  it('nextFloat returns values in [0, 1)', () => {
    let s = createRng('float')
    for (let i = 0; i < 1000; i++) {
      const r = nextFloat(s)
      expect(r.value).toBeGreaterThanOrEqual(0)
      expect(r.value).toBeLessThan(1)
      s = r.state
    }
  })
})
