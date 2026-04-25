import { describe, it, expect } from 'bun:test'
import { wallVariantForMask, NEIGHBOR_N, NEIGHBOR_E, NEIGHBOR_S, NEIGHBOR_W } from '../../src/render/wallAutotile'

describe('wallAutotile', () => {
  it('isolated wall (no neighbors) is a column piece', () => {
    expect(wallVariantForMask(0)).toBe('column_top')
  })

  it('fully surrounded wall renders as the inner brick', () => {
    expect(wallVariantForMask(NEIGHBOR_N | NEIGHBOR_E | NEIGHBOR_S | NEIGHBOR_W)).toBe('wall_mid')
  })

  it('only-S neighbor → top cap', () => {
    expect(wallVariantForMask(NEIGHBOR_S)).toBe('wall_top_mid')
  })

  it('top-left corner shape (E and S neighbors)', () => {
    expect(wallVariantForMask(NEIGHBOR_E | NEIGHBOR_S)).toBe('wall_corner_top_left')
  })

  it('top-right corner (W and S)', () => {
    expect(wallVariantForMask(NEIGHBOR_W | NEIGHBOR_S)).toBe('wall_corner_top_right')
  })

  it('left side (N and S)', () => {
    expect(wallVariantForMask(NEIGHBOR_N | NEIGHBOR_S)).toBe('wall_side_mid_left')
  })

  it('every 4-bit mask returns a defined string', () => {
    for (let m = 0; m < 16; m++) {
      const v = wallVariantForMask(m)
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })
})
