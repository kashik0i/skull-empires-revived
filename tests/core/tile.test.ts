import { describe, it, expect } from 'bun:test'
import { Tile } from '../../src/core/types'
import { isPassable, isOpaque, isPathable } from '../../src/core/tile'

describe('tile predicates', () => {
  it('passable: floor, stairs, shrine, open door, chest, open chest', () => {
    expect(isPassable(Tile.Floor)).toBe(true)
    expect(isPassable(Tile.Stairs)).toBe(true)
    expect(isPassable(Tile.Shrine)).toBe(true)
    expect(isPassable(Tile.DoorOpen)).toBe(true)
    expect(isPassable(Tile.Chest)).toBe(true)
    expect(isPassable(Tile.ChestOpen)).toBe(true)
  })

  it('not passable: void, wall, closed door', () => {
    expect(isPassable(Tile.Void)).toBe(false)
    expect(isPassable(Tile.Wall)).toBe(false)
    expect(isPassable(Tile.DoorClosed)).toBe(false)
  })

  it('opaque (blocks FOV): wall, closed door', () => {
    expect(isOpaque(Tile.Wall)).toBe(true)
    expect(isOpaque(Tile.DoorClosed)).toBe(true)
  })

  it('transparent (passes FOV): floor, stairs, shrine, open door, chests', () => {
    expect(isOpaque(Tile.Floor)).toBe(false)
    expect(isOpaque(Tile.Stairs)).toBe(false)
    expect(isOpaque(Tile.Shrine)).toBe(false)
    expect(isOpaque(Tile.DoorOpen)).toBe(false)
    expect(isOpaque(Tile.Chest)).toBe(false)
    expect(isOpaque(Tile.ChestOpen)).toBe(false)
  })

  it('pathable: every passable tile + closed doors (bump-to-open routing)', () => {
    expect(isPathable(Tile.Floor)).toBe(true)
    expect(isPathable(Tile.Stairs)).toBe(true)
    expect(isPathable(Tile.Shrine)).toBe(true)
    expect(isPathable(Tile.DoorClosed)).toBe(true)
    expect(isPathable(Tile.DoorOpen)).toBe(true)
    expect(isPathable(Tile.Chest)).toBe(true)
    expect(isPathable(Tile.ChestOpen)).toBe(true)
  })

  it('not pathable: void and walls', () => {
    expect(isPathable(Tile.Void)).toBe(false)
    expect(isPathable(Tile.Wall)).toBe(false)
  })
})
