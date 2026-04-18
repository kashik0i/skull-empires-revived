const STORAGE_KEY = 'skull-empires.flags.v1'

export type Flags = {
  showFps: boolean
  showHeroPath: boolean
  pauseEnemies: boolean
  invincibleHero: boolean
  revealMap: boolean
  /** When true (dev mode only), stream every action to .debug/{runId}.jsonl. */
  debugLog: boolean
  volume: number
  /** Tick speed multiplier: 1 = normal (300ms/tick), <1 = slower, >1 = faster. */
  tickSpeed: number
}

const DEFAULTS: Flags = {
  showFps: false,
  showHeroPath: false,
  pauseEnemies: false,
  invincibleHero: false,
  revealMap: false,
  debugLog: false,
  volume: 0.5,
  tickSpeed: 1,
}

const TICK_SPEED_MIN = 0.1
const TICK_SPEED_MAX = 5

export type FlagStore = {
  get(): Flags
  set<K extends keyof Flags>(key: K, value: Flags[K]): void
  subscribe(cb: (flags: Flags) => void): () => void
}

function clampVolume(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function clampTickSpeed(v: number): number {
  if (Number.isNaN(v)) return 1
  if (v < TICK_SPEED_MIN) return TICK_SPEED_MIN
  if (v > TICK_SPEED_MAX) return TICK_SPEED_MAX
  return v
}

export function createFlags(): FlagStore {
  let flags: Flags = { ...DEFAULTS, ...loadFromStorage() }
  const subs: ((f: Flags) => void)[] = []
  return {
    get() { return flags },
    set(key, value) {
      let nextValue: Flags[typeof key] = value
      if (key === 'volume') {
        nextValue = clampVolume(value as number) as Flags[typeof key]
      } else if (key === 'tickSpeed') {
        nextValue = clampTickSpeed(value as number) as Flags[typeof key]
      }
      if (flags[key] === nextValue) return
      flags = { ...flags, [key]: nextValue }
      save(flags)
      for (const cb of subs) cb(flags)
    },
    subscribe(cb) {
      subs.push(cb)
      return () => {
        const i = subs.indexOf(cb)
        if (i >= 0) subs.splice(i, 1)
      }
    },
  }
}

function loadFromStorage(): Partial<Flags> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const valid: Partial<Flags> = {}
    for (const key of Object.keys(DEFAULTS) as (keyof Flags)[]) {
      const defaultValue = DEFAULTS[key]
      const incoming = parsed[key]
      if (typeof defaultValue === 'boolean' && typeof incoming === 'boolean') {
        (valid as Record<string, unknown>)[key] = incoming
      } else if (typeof defaultValue === 'number' && typeof incoming === 'number') {
        if (key === 'volume') {
          (valid as Record<string, unknown>)[key] = clampVolume(incoming)
        } else if (key === 'tickSpeed') {
          (valid as Record<string, unknown>)[key] = clampTickSpeed(incoming)
        } else {
          (valid as Record<string, unknown>)[key] = incoming
        }
      }
    }
    return valid
  } catch {
    return {}
  }
}

function save(flags: Flags): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))
  } catch {
    // ignore
  }
}
