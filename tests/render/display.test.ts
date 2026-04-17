import { describe, it, expect } from 'bun:test'
import { createDisplayState } from '../../src/render/display'
import { createInitialWorld } from '../../src/core/state'

describe('display state', () => {
  it('initializes display actors at their state positions', () => {
    const w = createInitialWorld('d-1')
    const ds = createDisplayState()
    ds.sync(w)
    const hero = w.actors[w.heroId]
    const d = ds.get(w.heroId)!
    expect(d.x).toBe(hero.pos.x)
    expect(d.y).toBe(hero.pos.y)
  })

  it('starts a slide tween when an actor moves', () => {
    const w = createInitialWorld('d-2')
    const ds = createDisplayState()
    ds.sync(w)
    const hero = w.actors[w.heroId]
    const moved = {
      ...w,
      actors: {
        ...w.actors,
        [w.heroId]: { ...hero, pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    }
    ds.sync(moved)
    ds.tick(75)
    const d = ds.get(w.heroId)!
    expect(d.x).toBeGreaterThan(hero.pos.x)
    expect(d.x).toBeLessThan(hero.pos.x + 1)
    ds.tick(80)
    const d2 = ds.get(w.heroId)!
    expect(d2.x).toBe(hero.pos.x + 1)
  })

  it('drops entries for actors removed from state', () => {
    const w = createInitialWorld('d-3')
    const ds = createDisplayState()
    ds.sync(w)
    const dead = Object.keys(w.actors).find(id => id !== w.heroId)!
    const withoutDead = {
      ...w,
      actors: { ...w.actors },
    }
    delete withoutDead.actors[dead]
    ds.sync(withoutDead)
    expect(ds.get(dead)).toBeUndefined()
  })

  it('attack lunge overshoots then recoils without changing state', () => {
    const w = createInitialWorld('d-4')
    const ds = createDisplayState()
    ds.sync(w)
    const hero = w.actors[w.heroId]
    const targetPos = { x: hero.pos.x + 1, y: hero.pos.y }
    ds.startLunge(w.heroId, hero.pos, targetPos)
    ds.tick(40)
    const dMid = ds.get(w.heroId)!
    expect(dMid.x).toBeGreaterThan(hero.pos.x)
    ds.tick(40)
    const dPeak = ds.get(w.heroId)!
    expect(dPeak.x).toBeGreaterThan(hero.pos.x)
    ds.tick(80)
    const dEnd = ds.get(w.heroId)!
    expect(dEnd.x).toBeCloseTo(hero.pos.x, 2)
    expect(dEnd.y).toBeCloseTo(hero.pos.y, 2)
  })
})
