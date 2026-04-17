import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { intentForClick } from '../../src/input/intent'
import { Tile } from '../../src/core/types'

describe('intentForClick', () => {
  it('sets move-to intent for a click on a walkable floor tile', () => {
    const w = createInitialWorld('i-1')
    const hero = w.actors[w.heroId]
    // find any floor tile that isn't the hero's current tile
    let goal = { x: hero.pos.x + 1, y: hero.pos.y }
    if (w.floor.tiles[goal.y * w.floor.width + goal.x] !== Tile.Floor) {
      goal = { x: hero.pos.x - 1, y: hero.pos.y }
    }
    const action = intentForClick(w, goal)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: { kind: 'move-to', goal } })
  })

  it('sets attack intent for a click on an alive enemy (any distance)', () => {
    const w = createInitialWorld('i-2')
    const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
    const enemy = w.actors[enemyId]
    const action = intentForClick(w, enemy.pos)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: { kind: 'attack', targetId: enemyId } })
  })

  it('clears intent when the player clicks the hero’s own tile', () => {
    const w = createInitialWorld('i-3')
    const hero = w.actors[w.heroId]
    const action = intentForClick(w, hero.pos)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: null })
  })

  it('returns null for out-of-bounds clicks', () => {
    const w = createInitialWorld('i-4')
    expect(intentForClick(w, { x: -1, y: 0 })).toBeNull()
    expect(intentForClick(w, { x: w.floor.width, y: 0 })).toBeNull()
  })

  it('returns null for clicks on impassable tiles (walls)', () => {
    const w = createInitialWorld('i-5')
    // scan for any wall tile and click it
    let wallTile: { x: number; y: number } | null = null
    for (let y = 0; y < w.floor.height && !wallTile; y++) {
      for (let x = 0; x < w.floor.width; x++) {
        if (w.floor.tiles[y * w.floor.width + x] === Tile.Wall) { wallTile = { x, y }; break }
      }
    }
    expect(wallTile).not.toBeNull()
    const action = intentForClick(w, wallTile!)
    expect(action).toBeNull()
  })
})
