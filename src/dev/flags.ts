const STORAGE_KEY = 'skull-empires.flags.v1'

export type Flags = {
  showFps: boolean
  slowMotion: boolean
  showHeroPath: boolean
}

const DEFAULTS: Flags = {
  showFps: false,
  slowMotion: false,
  showHeroPath: false,
}

export type FlagStore = {
  get(): Flags
  set<K extends keyof Flags>(key: K, value: Flags[K]): void
  subscribe(cb: (flags: Flags) => void): () => void
}

export function createFlags(): FlagStore {
  let flags: Flags = { ...DEFAULTS, ...loadFromStorage() }
  const subs: ((f: Flags) => void)[] = []
  return {
    get() { return flags },
    set(key, value) {
      if (flags[key] === value) return
      flags = { ...flags, [key]: value }
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
      if (typeof parsed[key] === 'boolean') valid[key] = parsed[key] as boolean
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
