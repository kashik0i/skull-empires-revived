import { describe, it, expect } from 'bun:test'
import { firstStepToward, fullPathToward } from '../../src/ai/pathfind'
import { Tile } from '../../src/core/types'
import { createRng } from '../../src/core/rng'

function emptyWorld(w: number, h: number) {
  const tiles = new Uint8Array(w * h)
  tiles.fill(Tile.Floor)
  return {
    seed: 'doors',
    tick: 0,
    phase: 'exploring' as const,
    floor: { width: w, height: h, tiles, spawns: [] },
    actors: {},
    heroId: '',
    heroIntent: null,
    heroPath: [],
    turnOrder: [],
    turnIndex: 0,
    log: [],
    rng: createRng('doors'),
    revealed: false,
    droppedItems: [],
    loreScrolls: [],
    pendingDialog: null,
    inventory: [],
    equipment: { weapon: null, armor: null },
    groundItems: [],
    run: {
      depth: 1,
      rewardedThisFloor: false,
      pendingItemReward: null,
    },
  }
}

describe('pathfind: doors', () => {
  it('finds a path through an open door', () => {
    const w = emptyWorld(7, 1)
    w.floor.tiles[3] = Tile.DoorOpen
    const path = fullPathToward(w, { x: 0, y: 0 }, { x: 6, y: 0 })
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)
  })

  it('refuses to path through a closed door', () => {
    const w = emptyWorld(7, 1)
    w.floor.tiles[3] = Tile.DoorClosed
    const path = fullPathToward(w, { x: 0, y: 0 }, { x: 6, y: 0 })
    expect(path).toBeNull()
  })

  it('finds a path through a chest tile (treated as passable)', () => {
    const w = emptyWorld(5, 1)
    w.floor.tiles[2] = Tile.Chest
    const path = fullPathToward(w, { x: 0, y: 0 }, { x: 4, y: 0 })
    expect(path).not.toBeNull()
  })

  it('finds a path through a chest-open tile (treated as passable)', () => {
    const w = emptyWorld(5, 1)
    w.floor.tiles[2] = Tile.ChestOpen
    const path = fullPathToward(w, { x: 0, y: 0 }, { x: 4, y: 0 })
    expect(path).not.toBeNull()
  })

  it('firstStepToward respects open door as passable', () => {
    const w = emptyWorld(5, 1)
    w.floor.tiles[2] = Tile.DoorOpen
    const step = firstStepToward(w, { x: 0, y: 0 }, { x: 4, y: 0 })
    expect(step).toEqual({ x: 1, y: 0 })
  })

  it('firstStepToward treats closed door as impassable', () => {
    const w = emptyWorld(5, 1)
    w.floor.tiles[2] = Tile.DoorClosed
    const step = firstStepToward(w, { x: 0, y: 0 }, { x: 4, y: 0 })
    expect(step).toBeNull()
  })
})
