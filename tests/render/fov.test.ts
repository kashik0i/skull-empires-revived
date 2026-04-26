import { describe, it, expect } from 'bun:test'
import { Tile, type Floor } from '../../src/core/types'
import { computeVisible } from '../../src/render/fov'

function makeFloor(w: number, h: number, fill: number = Tile.Floor): Floor {
  const tiles = new Uint8Array(w * h)
  tiles.fill(fill)
  return { width: w, height: h, tiles, spawns: [] }
}

describe('fov: doors', () => {
  it('closed door blocks line of sight to tiles beyond', () => {
    const f = makeFloor(7, 1)
    f.tiles[3] = Tile.DoorClosed
    const v = computeVisible(f, { x: 0, y: 0 })
    expect(v[3]).toBe(1)        // the closed door itself is visible (you see what blocks you)
    expect(v[4]).toBe(0)        // beyond the door — hidden
  })

  it('open door does NOT block line of sight', () => {
    const f = makeFloor(7, 1)
    f.tiles[3] = Tile.DoorOpen
    const v = computeVisible(f, { x: 0, y: 0 })
    expect(v[4]).toBe(1)
    expect(v[5]).toBe(1)
  })
})
