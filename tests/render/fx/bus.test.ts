import { describe, it, expect } from 'bun:test'
import { createFxBus, type FxEvent } from '../../../src/render/fx/bus'

describe('fx bus', () => {
  it('publishes events to subscribers in order', () => {
    const bus = createFxBus()
    const got: FxEvent[] = []
    bus.subscribe(e => got.push(e))
    bus.publish({ kind: 'moved', actorId: 'hero-1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } })
    bus.publish({ kind: 'damaged', targetId: 'hero-1', amount: 3, pos: { x: 2, y: 1 }, isHero: true })
    bus.drain()
    expect(got.length).toBe(2)
    expect(got[0].kind).toBe('moved')
    expect(got[1].kind).toBe('damaged')
  })

  it('drain removes events from queue', () => {
    const bus = createFxBus()
    const got: FxEvent[] = []
    bus.subscribe(e => got.push(e))
    bus.publish({ kind: 'died', actorId: 'e1', pos: { x: 0, y: 0 }, archetype: 'bone-knight' })
    bus.drain()
    bus.drain() // second drain should be a no-op
    expect(got.length).toBe(1)
  })

  it('supports multiple subscribers', () => {
    const bus = createFxBus()
    const a: FxEvent[] = []
    const b: FxEvent[] = []
    bus.subscribe(e => a.push(e))
    bus.subscribe(e => b.push(e))
    bus.publish({ kind: 'run-ended', outcome: 'won' })
    bus.drain()
    expect(a.length).toBe(1)
    expect(b.length).toBe(1)
  })
})
