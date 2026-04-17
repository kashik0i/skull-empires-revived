import { describe, it, expect } from 'bun:test'
import { createRng } from '../../src/core/rng'
import { Tile } from '../../src/core/types'
import { generateBossFloor } from '../../src/procgen/boss'

describe('boss floor', () => {
  it('returns a floor with no Tile.Stairs', () => {
    const { floor } = generateBossFloor(createRng('boss-1'), 50, 40)
    const STAIRS_TILE = 3
    for (let i = 0; i < floor.tiles.length; i++) {
      expect(floor.tiles[i]).not.toBe(STAIRS_TILE)
    }
  })

  it('returns exactly 4 spawn points', () => {
    const { floor } = generateBossFloor(createRng('boss-2'), 50, 40)
    expect(floor.spawns.length).toBe(4)
  })

  it('all 4 spawn positions are floor tiles', () => {
    const { floor } = generateBossFloor(createRng('boss-3'), 50, 40)
    for (const spawn of floor.spawns) {
      const tileIndex = spawn.y * floor.width + spawn.x
      expect(floor.tiles[tileIndex]).toBe(Tile.Floor)
    }
  })

  it('is deterministic: same seed produces byte-identical floor', () => {
    const { floor: floor1 } = generateBossFloor(createRng('boss-seed'), 50, 40)
    const { floor: floor2 } = generateBossFloor(createRng('boss-seed'), 50, 40)
    expect(floor1.tiles).toEqual(floor2.tiles)
    expect(floor1.spawns).toEqual(floor2.spawns)
  })

  it('spawns are all distinct positions', () => {
    const { floor } = generateBossFloor(createRng('boss-4'), 50, 40)
    const positions = new Set<string>()
    for (const spawn of floor.spawns) {
      const key = `${spawn.x},${spawn.y}`
      expect(positions.has(key)).toBe(false)
      positions.add(key)
    }
    expect(positions.size).toBe(4)
  })
})
