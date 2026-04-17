import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'

describe('RunEnd / Restart reducers', () => {
  it('RunEnd sets phase to run_won', () => {
    const w = createInitialWorld('run-1')
    const w2 = rootReducer(w, { type: 'RunEnd', outcome: 'won' })
    expect(w2.phase).toBe('run_won')
  })

  it('RunEnd sets phase to run_lost', () => {
    const w = createInitialWorld('run-2')
    const w2 = rootReducer(w, { type: 'RunEnd', outcome: 'lost' })
    expect(w2.phase).toBe('run_lost')
  })

  it('Restart produces a fresh world with the new seed', () => {
    const w = createInitialWorld('run-3')
    const fresh = rootReducer(w, { type: 'Restart', seed: 'fresh-seed' })
    expect(fresh.seed).toBe('fresh-seed')
    expect(fresh.phase).toBe('exploring')
    expect(fresh.tick).toBe(0)
  })
})
