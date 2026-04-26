import { describe, it, expect } from 'bun:test'
import { Tile } from '../../src/core/types'
import { moveActor } from '../../src/core/reducers/move'
import { createInitialWorld } from '../../src/core/state'

function withTile(state: ReturnType<typeof createInitialWorld>, x: number, y: number, t: number) {
  const tiles = new Uint8Array(state.floor.tiles)
  tiles[y * state.floor.width + x] = t
  return { ...state, floor: { ...state.floor, tiles } }
}

describe('move: doors', () => {
  it('bumping a closed door opens it and does NOT move the actor', () => {
    let s = createInitialWorld('door-test-1')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.DoorClosed)
    const before = s.actors[s.heroId].pos
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(before)        // didn't move
    expect(after.floor.tiles[target.y * after.floor.width + target.x]).toBe(Tile.DoorOpen)
  })

  it('walking into an open door moves through normally', () => {
    let s = createInitialWorld('door-test-2')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.DoorOpen)
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(target)
  })

  it("door bump produces a state change that counts as the actor's action", () => {
    let s = createInitialWorld('door-turn-test')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.DoorClosed)
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    // The new state must DIFFER from the input state (returning the same `state` would mean "no-op",
    // which the loop interprets as no turn since apply() checks `if (after === before) return`).
    expect(after).not.toBe(s)
    expect(after.floor.tiles[target.y * after.floor.width + target.x]).toBe(Tile.DoorOpen)
  })
})
