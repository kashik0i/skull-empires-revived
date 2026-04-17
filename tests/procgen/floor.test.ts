import { describe, it, expect } from 'bun:test'
import { createRng } from '../../src/core/rng'
import { Tile } from '../../src/core/types'
import { generateFloor } from '../../src/procgen/floor'

describe('floor', () => {
  it('carves floor tiles where rooms and corridors are', () => {
    const { floor } = generateFloor(createRng('floor-1'), 40, 30)
    expect(floor.width).toBe(40)
    expect(floor.height).toBe(30)
    let floorCount = 0
    for (let i = 0; i < floor.tiles.length; i++) if (floor.tiles[i] === Tile.Floor) floorCount++
    expect(floorCount).toBeGreaterThan(20)
  })

  it('walls surround floor tiles', () => {
    const { floor } = generateFloor(createRng('floor-2'), 40, 30)
    for (let y = 1; y < floor.height - 1; y++) {
      for (let x = 1; x < floor.width - 1; x++) {
        if (floor.tiles[y * floor.width + x] === Tile.Floor) {
          const neighbours = [
            floor.tiles[(y - 1) * floor.width + x],
            floor.tiles[(y + 1) * floor.width + x],
            floor.tiles[y * floor.width + (x - 1)],
            floor.tiles[y * floor.width + (x + 1)],
          ]
          const validTiles: number[] = [Tile.Floor, Tile.Wall]
          for (const n of neighbours) {
            expect(validTiles).toContain(n)
          }
        }
      }
    }
  })

  it('produces at least two spawn points on floor tiles', () => {
    const { floor } = generateFloor(createRng('floor-3'), 40, 30)
    expect(floor.spawns.length).toBeGreaterThanOrEqual(2)
    for (const s of floor.spawns) {
      expect(floor.tiles[s.y * floor.width + s.x]).toBe(Tile.Floor)
    }
  })
})
