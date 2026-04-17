import { describe, it, expect } from 'bun:test'
import { lerp, easeOutCubic, easeInOutQuad, createTweens } from '../../../src/render/fx/tweens'

describe('tween primitives', () => {
  it('lerp interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 1)).toBe(10)
    expect(lerp(0, 10, 0.5)).toBeCloseTo(5)
  })

  it('easeOutCubic clamps to [0,1] and accelerates', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 2)
    expect(easeOutCubic(-0.1)).toBe(0)
    expect(easeOutCubic(1.5)).toBe(1)
  })

  it('easeInOutQuad symmetric', () => {
    expect(easeInOutQuad(0)).toBe(0)
    expect(easeInOutQuad(1)).toBe(1)
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5)
  })
})

describe('tween manager', () => {
  it('ticks active tweens and fires onComplete', () => {
    const m = createTweens()
    let done = false
    let latest = 0
    m.add({
      durationMs: 100,
      onTick: t => { latest = t },
      onComplete: () => { done = true },
    })
    m.tick(50)
    expect(latest).toBeCloseTo(0.5)
    expect(done).toBe(false)
    m.tick(60) // overshoots
    expect(done).toBe(true)
    expect(latest).toBe(1)
    m.tick(10) // completed tween removed
    expect(latest).toBe(1)
  })

  it('supports multiple concurrent tweens', () => {
    const m = createTweens()
    const got: string[] = []
    m.add({ durationMs: 50, onTick: () => {}, onComplete: () => got.push('a') })
    m.add({ durationMs: 100, onTick: () => {}, onComplete: () => got.push('b') })
    m.tick(60)
    m.tick(60)
    expect(got).toEqual(['a', 'b'])
  })
})
