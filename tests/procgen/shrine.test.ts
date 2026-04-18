import { describe, it, expect } from 'bun:test'
import { generateFloor } from '../../src/procgen/floor'
import { createRng } from '../../src/core/rng'
import { Tile } from '../../src/core/types'

describe('shrine procgen', () => {
  it('places exactly 0 or 1 shrine tiles per floor across 200 seeds', () => {
    let withShrine = 0
    const N = 200
    for (let i = 0; i < N; i++) {
      const { floor } = generateFloor(createRng(`shrine-${i}`), 40, 30)
      let count = 0
      for (let j = 0; j < floor.tiles.length; j++) {
        if (floor.tiles[j] === Tile.Shrine) count++
      }
      expect(count).toBeLessThanOrEqual(1)
      if (count === 1) withShrine++
    }
    expect(withShrine).toBeGreaterThan(N * 0.15)
    expect(withShrine).toBeLessThan(N * 0.35)
  })
})
