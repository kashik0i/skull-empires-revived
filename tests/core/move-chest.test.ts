import { describe, it, expect } from 'bun:test'
import { Tile } from '../../src/core/types'
import { moveActor } from '../../src/core/reducers/move'
import { createInitialWorld } from '../../src/core/state'

function withTile(state: ReturnType<typeof createInitialWorld>, x: number, y: number, t: number) {
  const tiles = new Uint8Array(state.floor.tiles)
  tiles[y * state.floor.width + x] = t
  return { ...state, floor: { ...state.floor, tiles } }
}

describe('move: chests', () => {
  it('stepping on a closed chest opens it and drops one item on the same tile', () => {
    let s = createInitialWorld('chest-test-1')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.Chest)
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(target)
    expect(after.floor.tiles[target.y * after.floor.width + target.x]).toBe(Tile.ChestOpen)
    expect(after.groundItems.some(g => g.pos.x === target.x && g.pos.y === target.y)).toBe(true)
  })

  it('walking back over an open chest is a normal move (no double drop)', () => {
    let s = createInitialWorld('chest-test-2')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.ChestOpen)
    const before = s.groundItems.length
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(target)
    expect(after.groundItems.length).toBe(before)
  })
})
