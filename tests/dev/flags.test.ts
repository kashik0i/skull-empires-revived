import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createFlags } from '../../src/dev/flags'

const g = globalThis as Record<string, unknown>
let oldLocalStorage: unknown
let storage: Map<string, string>

beforeEach(() => {
  oldLocalStorage = g.localStorage
  storage = new Map<string, string>()
  g.localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
    removeItem: (k: string) => { storage.delete(k) },
  }
})

afterEach(() => {
  g.localStorage = oldLocalStorage
})

describe('flag store', () => {
  it('starts with documented defaults', () => {
    const flags = createFlags()
    expect(flags.get()).toEqual({
      showFps: false,
      showHeroPath: false,
      pauseEnemies: false,
      invincibleHero: false,
      revealMap: false,
      volume: 0.5,
      tickSpeed: 1,
    })
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
    a.set('showHeroPath', true)
    const b = createFlags()
    expect(b.get().showHeroPath).toBe(true)
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

  it('toggles pauseEnemies, invincibleHero, revealMap', () => {
    const flags = createFlags()
    flags.set('pauseEnemies', true)
    flags.set('invincibleHero', true)
    flags.set('revealMap', true)
    expect(flags.get().pauseEnemies).toBe(true)
    expect(flags.get().invincibleHero).toBe(true)
    expect(flags.get().revealMap).toBe(true)
    flags.set('pauseEnemies', false)
    expect(flags.get().pauseEnemies).toBe(false)
  })

  it('clamps volume setter to [0, 1]', () => {
    const flags = createFlags()
    flags.set('volume', -0.5)
    expect(flags.get().volume).toBe(0)
    flags.set('volume', 2)
    expect(flags.get().volume).toBe(1)
    flags.set('volume', 0.75)
    expect(flags.get().volume).toBe(0.75)
  })

  it('persists volume and boolean flags across re-create', () => {
    const a = createFlags()
    a.set('volume', 0.3)
    a.set('invincibleHero', true)
    const b = createFlags()
    expect(b.get().volume).toBe(0.3)
    expect(b.get().invincibleHero).toBe(true)
  })

  it('fills in defaults when localStorage payload is missing new fields', () => {
    // Old shape: just the original booleans (pre-tickSpeed, pre-volume).
    storage.set('skull-empires.flags.v1', JSON.stringify({
      showFps: true,
      showHeroPath: false,
    }))
    const flags = createFlags()
    expect(flags.get()).toEqual({
      showFps: true,
      showHeroPath: false,
      pauseEnemies: false,
      invincibleHero: false,
      revealMap: false,
      volume: 0.5,
      tickSpeed: 1,
    })
  })

  it('clamps tickSpeed to [0.1, 5]', () => {
    const flags = createFlags()
    flags.set('tickSpeed', 0.01)
    expect(flags.get().tickSpeed).toBe(0.1)
    flags.set('tickSpeed', 100)
    expect(flags.get().tickSpeed).toBe(5)
    flags.set('tickSpeed', 2)
    expect(flags.get().tickSpeed).toBe(2)
  })
})
