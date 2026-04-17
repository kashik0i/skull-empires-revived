import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'
import { Tile } from '../../../src/core/types'

/** Find the position of the Stairs tile on the floor, or null if none. */
function findStairsPos(world: ReturnType<typeof createInitialWorld>) {
  const { floor } = world
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (floor.tiles[y * floor.width + x] === Tile.Stairs) {
        return { x, y }
      }
    }
  }
  return null
}

/** Teleport hero to a specific position (bypass movement rules for test setup). */
function teleportHero(
  world: ReturnType<typeof createInitialWorld>,
  pos: { x: number; y: number },
) {
  return {
    ...world,
    actors: {
      ...world.actors,
      [world.heroId]: {
        ...world.actors[world.heroId],
        pos,
      },
    },
  }
}

describe('Descend reducer', () => {
  it('increments depth from 1 to 2 when hero is on stairs', () => {
    const w = createInitialWorld('descend-1')
    const stairsPos = findStairsPos(w)
    expect(stairsPos).not.toBeNull()

    const w2 = rootReducer(teleportHero(w, stairsPos!), { type: 'Descend' })
    expect(w2.run.depth).toBe(2)
  })

  it('generates a new floor (tile array differs from original)', () => {
    const w = createInitialWorld('descend-2')
    const stairsPos = findStairsPos(w)
    expect(stairsPos).not.toBeNull()

    const w2 = rootReducer(teleportHero(w, stairsPos!), { type: 'Descend' })
    // The new floor is extremely unlikely to be byte-for-byte identical
    const oldTiles = Array.from(w.floor.tiles)
    const newTiles = Array.from(w2.floor.tiles)
    expect(newTiles).not.toEqual(oldTiles)
  })

  it('places hero at spawns[0] of the new floor', () => {
    const w = createInitialWorld('descend-3')
    const stairsPos = findStairsPos(w)
    expect(stairsPos).not.toBeNull()

    const w2 = rootReducer(teleportHero(w, stairsPos!), { type: 'Descend' })
    const hero = w2.actors[w2.heroId]
    expect(hero.pos).toEqual(w2.floor.spawns[0])
  })

  it('preserves hero hp after descend', () => {
    const w = createInitialWorld('descend-4')
    const stairsPos = findStairsPos(w)
    expect(stairsPos).not.toBeNull()

    const hero = w.actors[w.heroId]
    const w2 = rootReducer(teleportHero(w, stairsPos!), { type: 'Descend' })
    const hero2 = w2.actors[w2.heroId]
    expect(hero2.hp).toBe(hero.hp)
    expect(hero2.maxHp).toBe(hero.maxHp)
  })

  it('resets heroIntent and heroPath', () => {
    const w = createInitialWorld('descend-5')
    const stairsPos = findStairsPos(w)
    expect(stairsPos).not.toBeNull()

    const wWithIntent = {
      ...teleportHero(w, stairsPos!),
      heroIntent: { kind: 'move-to' as const, goal: { x: 1, y: 1 } },
      heroPath: [{ x: 1, y: 1 }],
    }
    const w2 = rootReducer(wWithIntent, { type: 'Descend' })
    expect(w2.heroIntent).toBeNull()
    expect(w2.heroPath).toEqual([])
  })

  it('is a no-op when hero is not on stairs', () => {
    const w = createInitialWorld('descend-noop-1')
    const hero = w.actors[w.heroId]
    // Hero spawn is a Floor tile, not Stairs
    expect(w.floor.tiles[hero.pos.y * w.floor.width + hero.pos.x]).toBe(Tile.Floor)

    const w2 = rootReducer(w, { type: 'Descend' })
    expect(w2.run.depth).toBe(1)
    expect(w2.floor).toBe(w.floor)
  })

  it('is a no-op when depth is 5 (boss floor is terminal)', () => {
    const w = createInitialWorld('descend-depth5')
    const stairsPos = findStairsPos(w)
    // Force depth=5
    const wAt5 = stairsPos
      ? { ...teleportHero(w, stairsPos), run: { ...w.run, depth: 5 } }
      : { ...w, run: { ...w.run, depth: 5 } }

    const w2 = rootReducer(wAt5, { type: 'Descend' })
    expect(w2.run.depth).toBe(5)
    expect(w2.floor).toBe(wAt5.floor)
  })

  it('is deterministic: same seed + Descend → same new floor', () => {
    const seed = 'descend-det'
    const w1 = createInitialWorld(seed)
    const w2 = createInitialWorld(seed)

    const stairsPos1 = findStairsPos(w1)
    const stairsPos2 = findStairsPos(w2)
    expect(stairsPos1).not.toBeNull()

    const after1 = rootReducer(teleportHero(w1, stairsPos1!), { type: 'Descend' })
    const after2 = rootReducer(teleportHero(w2, stairsPos2!), { type: 'Descend' })

    expect(Array.from(after1.floor.tiles)).toEqual(Array.from(after2.floor.tiles))
    expect(after1.floor.spawns).toEqual(after2.floor.spawns)
  })

  it('depth 4 → 5 generates floor without stairs (boss floor)', () => {
    const w = createInitialWorld('descend-depth4')
    const stairsPos = findStairsPos(w)
    expect(stairsPos).not.toBeNull()

    const wAt4 = { ...teleportHero(w, stairsPos!), run: { ...w.run, depth: 4 } }
    const w2 = rootReducer(wAt4, { type: 'Descend' })
    expect(w2.run.depth).toBe(5)

    // Boss floor should have no Stairs tile
    const hasStairs = Array.from(w2.floor.tiles).includes(Tile.Stairs)
    expect(hasStairs).toBe(false)
  })
})
