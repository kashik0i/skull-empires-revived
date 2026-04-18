import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { Tile } from '../../../src/core/types'

describe('initial state', () => {
  it('places hero on a floor tile', () => {
    const w = createInitialWorld('seed-1')
    const hero = w.actors[w.heroId]
    expect(hero).toBeDefined()
    expect(hero.kind).toBe('hero')
    expect(w.floor.tiles[hero.pos.y * w.floor.width + hero.pos.x]).toBe(Tile.Floor)
  })

  it('spawns 2+ enemies on floor tiles drawn from the floor-1 composition', () => {
    const w = createInitialWorld('seed-1')
    const enemies = Object.values(w.actors).filter(a => a.kind === 'enemy')
    expect(enemies.length).toBeGreaterThanOrEqual(2)
    const floor1Archetypes = new Set(['bone-knight', 'tiny-zombie'])
    for (const e of enemies) {
      expect(w.floor.tiles[e.pos.y * w.floor.width + e.pos.x]).toBe(Tile.Floor)
      expect(floor1Archetypes.has(e.archetype)).toBe(true)
    }
  })

  it('is deterministic for the same seed', () => {
    const a = createInitialWorld('seed-deterministic')
    const b = createInitialWorld('seed-deterministic')
    expect(a.actors).toEqual(b.actors)
    expect(Array.from(a.floor.tiles)).toEqual(Array.from(b.floor.tiles))
  })

  it('starts in exploring phase with empty log', () => {
    const w = createInitialWorld('seed-1')
    expect(w.phase).toBe('exploring')
    expect(w.log).toEqual([])
    expect(w.tick).toBe(0)
  })
})
