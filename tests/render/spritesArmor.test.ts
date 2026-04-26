import { describe, it, expect } from 'bun:test'
import { getFrame } from '../../src/render/sprites'

describe('armor frames', () => {
  it('armor_cloth, armor_leather, armor_plate are registered', () => {
    expect(getFrame('armor_cloth')).not.toBeNull()
    expect(getFrame('armor_leather')).not.toBeNull()
    expect(getFrame('armor_plate')).not.toBeNull()
  })

  it('the three armor frames have distinct horizontal offsets in the same atlas', () => {
    const a = getFrame('armor_cloth')!
    const b = getFrame('armor_leather')!
    const c = getFrame('armor_plate')!
    expect(a.x).not.toBe(b.x)
    expect(b.x).not.toBe(c.x)
    expect(a.w).toBe(16)
    expect(b.w).toBe(16)
    expect(c.w).toBe(16)
  })
})
