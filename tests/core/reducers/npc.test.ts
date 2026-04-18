import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { Actor, World } from '../../../src/core/types'

describe('npc actors', () => {
  it('hero attack against an NPC is rejected', () => {
    const base = createInitialWorld('npc-1')
    const heroPos = base.actors[base.heroId].pos
    const npc: Actor = {
      id: 'merchant-test',
      kind: 'npc',
      archetype: 'merchant',
      pos: { x: heroPos.x + 1, y: heroPos.y },
      hp: 1, maxHp: 1, atk: 0, def: 0,
      alive: true,
      statusEffects: [],
    }
    const state: World = { ...base, actors: { ...base.actors, [npc.id]: npc } }
    const next = dispatch(state, { type: 'AttackActor', attackerId: base.heroId, targetId: npc.id })
    expect(next.actors[npc.id].hp).toBe(1)
    expect(next.actors[npc.id].alive).toBe(true)
  })
})
