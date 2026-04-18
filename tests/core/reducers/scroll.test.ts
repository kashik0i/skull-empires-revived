import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'

describe('scroll pickup', () => {
  it('initial world has exactly one lore scroll', () => {
    const w = createInitialWorld('scroll-1')
    expect(w.loreScrolls.length).toBe(1)
    expect(w.loreScrolls[0].fragmentIndex).toBe(0)
  })

  it('hero stepping on a scroll removes it and opens dialog', () => {
    const base = createInitialWorld('scroll-2')
    const heroId = base.heroId
    const hero = base.actors[heroId]
    const scrollPos = { x: hero.pos.x + 1, y: hero.pos.y }
    const state = { ...base, loreScrolls: [{ id: 'scroll-test', pos: scrollPos, fragmentIndex: 0 }] }
    const next = dispatch(state, { type: 'MoveActor', actorId: heroId, to: scrollPos })
    expect(next.loreScrolls.length).toBe(0)
    expect(next.pendingDialog).not.toBeNull()
    expect(next.pendingDialog!.title.length).toBeGreaterThan(0)
  })
})
