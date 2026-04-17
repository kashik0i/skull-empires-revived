import { describe, it, expect } from 'bun:test'
import { encodeRun, decodeRun } from '../../src/persistence/url'
import type { Action } from '../../src/core/types'

describe('url encode/decode', () => {
  it('round-trips seed + action log', () => {
    const seed = 'alpha-seed'
    const log: Action[] = [
      { type: 'MoveActor', actorId: 'hero-1', to: { x: 3, y: 4 } },
      { type: 'AttackActor', attackerId: 'hero-1', targetId: 'enemy-1' },
      { type: 'TurnAdvance' },
    ]
    const encoded = encodeRun(seed, log)
    const decoded = decodeRun(encoded)
    expect(decoded?.seed).toBe(seed)
    expect(decoded?.log).toEqual(log)
  })

  it('returns null on malformed input', () => {
    expect(decodeRun('not-a-real-encoding')).toBeNull()
  })
})
