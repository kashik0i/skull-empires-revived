import { describe, it, expect } from 'bun:test'
import { firstStepToward, manhattan } from '../../src/ai/pathfind'
import { createInitialWorld } from '../../src/core/state'
import { Tile } from '../../src/core/types'
import { createRng } from '../../src/core/rng'
import { generateFloor } from '../../src/procgen/floor'

function emptyWorld(w: number, h: number) {
  const tiles = new Uint8Array(w * h)
  tiles.fill(Tile.Floor)
  return {
    seed: 'x',
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
    rng: createRng('x'),
    revealed: false,
    droppedItems: [],
    loreScrolls: [],
    pendingDialog: null,
    inventory: [],
    equipment: { weapon: null, armor: null },
    groundItems: [],
    run: {
      depth: 1,
      cards: { deck: [], hand: [], discard: [] },
      pendingReward: null,
      rewardedThisFloor: false,
    },
  }
}

describe('firstStepToward', () => {
  it('returns a step toward the goal on an open plane', () => {
    const w = emptyWorld(10, 10)
    const step = firstStepToward(w, { x: 0, y: 0 }, { x: 5, y: 0 })
    expect(step).toEqual({ x: 1, y: 0 })
  })

  it('routes around walls', () => {
    const w = emptyWorld(10, 10)
    // wall column at x=1 except at y=9
    for (let y = 0; y < 9; y++) w.floor.tiles[y * 10 + 1] = Tile.Wall
    const step = firstStepToward(w, { x: 0, y: 0 }, { x: 5, y: 0 })
    // First step must not go into the wall
    expect(step).not.toEqual({ x: 1, y: 0 })
    expect(step).toBeDefined()
  })

  it('returns null when the goal is unreachable', () => {
    const w = emptyWorld(10, 10)
    for (let y = 0; y < 10; y++) w.floor.tiles[y * 10 + 5] = Tile.Wall
    const step = firstStepToward(w, { x: 0, y: 0 }, { x: 9, y: 0 })
    expect(step).toBeNull()
  })

  it('treats alive actors as impassable', () => {
    const w = emptyWorld(10, 10)
    const blocker = { id: 'b', kind: 'enemy' as const, archetype: 'bone-knight', pos: { x: 1, y: 0 }, hp: 5, maxHp: 5, atk: 1, def: 0, alive: true }
    w.actors = { b: blocker }
    const step = firstStepToward(w, { x: 0, y: 0 }, { x: 3, y: 0 })
    expect(step).not.toEqual({ x: 1, y: 0 })
    // either (0,1) or null; must not walk into blocker
    if (step) expect(step).not.toEqual(blocker.pos)
  })

  it('passThroughActors allows pathing onto the target', () => {
    const w = emptyWorld(5, 5)
    const target = { id: 't', kind: 'enemy' as const, archetype: 'bone-knight', pos: { x: 4, y: 0 }, hp: 5, maxHp: 5, atk: 1, def: 0, alive: true }
    w.actors = { t: target }
    const step = firstStepToward(w, { x: 0, y: 0 }, { x: 4, y: 0 }, { passThroughActors: ['t'] })
    expect(step).toEqual({ x: 1, y: 0 })
  })

  it('returns null when start === goal', () => {
    const w = emptyWorld(5, 5)
    expect(firstStepToward(w, { x: 2, y: 2 }, { x: 2, y: 2 })).toBeNull()
  })

  it('finds paths in a real procgen floor', () => {
    const world = createInitialWorld('pf-real-1')
    const hero = world.actors[world.heroId]
    const enemy = Object.values(world.actors).find(a => a.kind === 'enemy')!
    const step = firstStepToward(world, hero.pos, enemy.pos, { passThroughActors: [enemy.id] })
    // Must be adjacent to hero (or null if no path)
    if (step) {
      expect(manhattan(step, hero.pos)).toBe(1)
    }
    // On default 40x30 BSP floor with spawns at room centers, path should exist
    expect(step).not.toBeNull()
    void generateFloor // keep import alive
  })
})
