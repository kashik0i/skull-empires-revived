import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createFlags } from '../../src/dev/flags'

const g = globalThis as Record<string, unknown>
let oldLocalStorage: unknown

beforeEach(() => {
  oldLocalStorage = g.localStorage
  const store = new Map<string, string>()
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
})

afterEach(() => {
  g.localStorage = oldLocalStorage
})

describe('flag store', () => {
  it('starts with all-false defaults', () => {
    const flags = createFlags()
    expect(flags.get()).toEqual({ showFps: false, slowMotion: false, showHeroPath: false })
  })

  it('set updates a flag and notifies subscribers', () => {
    const flags = createFlags()
    let calls = 0
    let last = flags.get()
    flags.subscribe(f => { calls++; last = f })
    flags.set('showFps', true)
    expect(calls).toBe(1)
    expect(last.showFps).toBe(true)
  })

  it('set is a no-op when value is unchanged', () => {
    const flags = createFlags()
    let calls = 0
    flags.subscribe(() => { calls++ })
    flags.set('showFps', false)
    expect(calls).toBe(0)
  })

  it('persists changes to localStorage and restores on re-create', () => {
    const a = createFlags()
    a.set('slowMotion', true)
    const b = createFlags()
    expect(b.get().slowMotion).toBe(true)
  })

  it('unsubscribe stops notifications', () => {
    const flags = createFlags()
    let calls = 0
    const off = flags.subscribe(() => { calls++ })
    flags.set('showFps', true)
    off()
    flags.set('showFps', false)
    expect(calls).toBe(1)
  })
})
