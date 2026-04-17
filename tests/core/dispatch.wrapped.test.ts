import { describe, it, expect } from 'bun:test'
import { dispatchWithFx } from '../../src/core/dispatch'
import { createFxBus, type FxEvent } from '../../src/render/fx/bus'
import { createInitialWorld } from '../../src/core/state'

describe('dispatchWithFx', () => {
  it('publishes a moved event when MoveActor succeeds', () => {
    const w = createInitialWorld('fx-d-1')
    const bus = createFxBus()
    const got: FxEvent[] = []
    bus.subscribe(e => got.push(e))
    const hero = w.actors[w.heroId]
    const to = { x: hero.pos.x + 1, y: hero.pos.y }
    const w2 = dispatchWithFx(w, { type: 'MoveActor', actorId: w.heroId, to }, bus)
    bus.drain()
    expect(w2).not.toBe(w)
    const moved = got.find(e => e.kind === 'moved')
    expect(moved).toBeDefined()
    if (moved?.kind === 'moved') {
      expect(moved.actorId).toBe(w.heroId)
      expect(moved.from).toEqual(hero.pos)
      expect(moved.to).toEqual(to)
    }
  })

  it('publishes attacked + damaged when AttackActor succeeds', () => {
    const base = createInitialWorld('fx-d-2')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    }
    const bus = createFxBus()
    const got: FxEvent[] = []
    bus.subscribe(e => got.push(e))
    dispatchWithFx(w, { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }, bus)
    bus.drain()
    expect(got.some(e => e.kind === 'attacked')).toBe(true)
    expect(got.some(e => e.kind === 'damaged')).toBe(true)
  })

  it('publishes died when target hp drops to 0', () => {
    const base = createInitialWorld('fx-d-3')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: { x: hero.pos.x + 1, y: hero.pos.y }, hp: 1 },
      },
    }
    const bus = createFxBus()
    const got: FxEvent[] = []
    bus.subscribe(e => got.push(e))
    dispatchWithFx(w, { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }, bus)
    bus.drain()
    expect(got.some(e => e.kind === 'died')).toBe(true)
  })

  it('does not publish anything when action is a no-op', () => {
    const w = createInitialWorld('fx-d-4')
    const bus = createFxBus()
    const got: FxEvent[] = []
    bus.subscribe(e => got.push(e))
    dispatchWithFx(w, { type: 'MoveActor', actorId: w.heroId, to: { x: -5, y: -5 } }, bus)
    bus.drain()
    expect(got.length).toBe(0)
  })
})
