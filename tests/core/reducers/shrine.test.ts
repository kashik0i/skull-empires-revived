import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import { Tile } from '../../../src/core/types'

describe('shrine resolve', () => {
  it('blood grants +2 maxHp and +2 hp', () => {
    const base = createInitialWorld('shrine-b')
    const hero = base.actors[base.heroId]
    const pos = hero.pos
    const next = dispatch(base, { type: 'ResolveShrine', choice: 'blood', pos })
    expect(next.actors[base.heroId].maxHp).toBe(hero.maxHp + 2)
    expect(next.actors[base.heroId].hp).toBe(hero.hp + 2)
  })

  it('breath grants +1 atk', () => {
    const base = createInitialWorld('shrine-r')
    const hero = base.actors[base.heroId]
    const pos = hero.pos
    const next = dispatch(base, { type: 'ResolveShrine', choice: 'breath', pos })
    expect(next.actors[base.heroId].atk).toBe(hero.atk + 1)
  })

  it('converts shrine tile to floor after resolve', () => {
    const base = createInitialWorld('shrine-convert')
    const pos = { x: 5, y: 5 }
    const newTiles = new Uint8Array(base.floor.tiles)
    newTiles[pos.y * base.floor.width + pos.x] = Tile.Shrine
    const state = { ...base, floor: { ...base.floor, tiles: newTiles } }
    const next = dispatch(state, { type: 'ResolveShrine', choice: 'blood', pos })
    expect(next.floor.tiles[pos.y * next.floor.width + pos.x]).toBe(Tile.Floor)
  })
})
