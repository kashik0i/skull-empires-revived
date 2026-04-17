export type RngState = Readonly<{ a: number; b: number; c: number; d: number }>

function hashSeed(seed: string): RngState {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  const a = (h = Math.imul(h ^ (h >>> 16), 2246822507)) >>> 0
  const b = (h = Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0
  const c = (h = Math.imul(h ^ (h >>> 16), 2246822507)) >>> 0
  const d = (h = Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0
  return { a, b, c, d }
}

export function createRng(seed: string): RngState {
  return hashSeed(seed)
}

export function nextU32(s: RngState): { value: number; state: RngState } {
  const t = (s.a + s.b + s.d + 1) >>> 0
  const a = s.b ^ (s.b >>> 9)
  const b = (s.c + (s.c << 3)) >>> 0
  const c = ((s.c << 21) | (s.c >>> 11)) >>> 0
  const d = (s.d + 1) >>> 0
  return { value: t, state: { a, b, c: (c + t) >>> 0, d } }
}

export function nextFloat(s: RngState): { value: number; state: RngState } {
  const r = nextU32(s)
  return { value: r.value / 0x100000000, state: r.state }
}

export function nextInt(s: RngState, min: number, maxExclusive: number): { value: number; state: RngState } {
  const r = nextFloat(s)
  return { value: min + Math.floor(r.value * (maxExclusive - min)), state: r.state }
}
