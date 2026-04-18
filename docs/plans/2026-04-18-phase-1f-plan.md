# Phase 1F Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking. Waves run in parallel internally; serialize between waves. Each task ends in one commit.

**Goal:** Implement Phase 1F per `docs/plans/2026-04-18-phase-1f-design.md` — side-panel HUD, mobile drawer, richer + dynamic music, music UI, minimap zoom toggle, MIDI export.

**Architecture:** First land the layout shell (HTML grid + side panel module + canvas resize observer). Then port HUD/inventory/minimap into the panel one-by-one without changing their internal logic. Music is extended in-place: new voices added inside `createMusic`, with combat intensity reading World on each tick. MIDI export is a small encoder fed by a capture buffer inside `createMusic`. Mobile + zoom + UI controls land last on top of the new shell.

**Tech Stack:** Bun + Vite + TypeScript strict, existing reducer/render pattern, Web Audio API, no new deps. Pure-function MIDI encoder.

**Working directory:** `.worktrees/phase-1f`
**Branch:** `feat/phase-1f`

**Conventions:**
- TDD where pure (MIDI encoder, capture ring buffer, minimap window math, responsive observer). DOM/audio glue and layout get manual smoke at end of plan.
- Each task ends with `bun run typecheck` + relevant `bun test` + commit.
- All paths relative to the worktree.
- World shape is unchanged — replay tests must keep passing.

---

## Setup

### T0: Worktree

- [ ] **Step 1:** From `master` create worktree + branch.

```bash
cd /home/amr/source/repos/kashik0i/skull-empires-revived
git worktree add .worktrees/phase-1f -b feat/phase-1f master
cd .worktrees/phase-1f
bun install
bun run typecheck
bun test
```

Expected: clean typecheck, ~199 tests pass.

---

## Wave 1 — Pure foundations (parallel-safe, 3 tasks)

### T1: Responsive observer

**Files:**
- Create: `src/dev/responsive.ts`
- Create: `tests/dev/responsive.test.ts`

**Goal:** A tiny observable wrapping `matchMedia('(max-width: 768px)')` so any caller can subscribe to mobile/desktop transitions.

- [ ] **Step 1: Write the failing test.**

`tests/dev/responsive.test.ts`:
```ts
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { createResponsive } from '../../src/dev/responsive'

type Listener = (e: { matches: boolean }) => void

function mockMatchMedia(initialMatches: boolean): { setMatches(v: boolean): void } {
  let listeners: Listener[] = []
  let matches = initialMatches
  ;(globalThis as any).matchMedia = (_q: string) => ({
    get matches() { return matches },
    addEventListener: (_t: string, l: Listener) => { listeners.push(l) },
    removeEventListener: (_t: string, l: Listener) => { listeners = listeners.filter(x => x !== l) },
  })
  return {
    setMatches(v: boolean) { matches = v; for (const l of listeners) l({ matches: v }) },
  }
}

describe('createResponsive', () => {
  beforeEach(() => { mockMatchMedia(false) })

  it('reports current isMobile value', () => {
    mockMatchMedia(true)
    const r = createResponsive()
    expect(r.isMobile()).toBe(true)
  })

  it('notifies subscribers on change', () => {
    const ctl = mockMatchMedia(false)
    const r = createResponsive()
    const seen: boolean[] = []
    r.subscribe(v => seen.push(v))
    ctl.setMatches(true)
    ctl.setMatches(false)
    expect(seen).toEqual([true, false])
  })

  it('returns an unsubscribe handle', () => {
    const ctl = mockMatchMedia(false)
    const r = createResponsive()
    const seen: boolean[] = []
    const off = r.subscribe(v => seen.push(v))
    off()
    ctl.setMatches(true)
    expect(seen).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect failure.**
Run: `bun test tests/dev/responsive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/dev/responsive.ts`.**

```ts
export type Responsive = {
  isMobile(): boolean
  subscribe(cb: (isMobile: boolean) => void): () => void
}

export function createResponsive(query = '(max-width: 768px)'): Responsive {
  const mql = matchMedia(query)
  const subs = new Set<(v: boolean) => void>()
  mql.addEventListener('change', e => { for (const s of subs) s(e.matches) })
  return {
    isMobile: () => mql.matches,
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb) },
  }
}
```

- [ ] **Step 4: Run — expect pass.**
Run: `bun test tests/dev/responsive.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit.**
```bash
git add src/dev/responsive.ts tests/dev/responsive.test.ts
git commit -m "feat(dev): responsive observer wrapping matchMedia"
```

---

### T2: MIDI encoder

**Files:**
- Create: `src/audio/midiExport.ts`
- Create: `tests/audio/midiExport.test.ts`

**Goal:** Pure function that takes captured note events and produces a MIDI Type-1 byte array. Plus a tiny `downloadMidi` helper. Tests cover encoder; download is glue.

**Encoder shape:**
```ts
export type CapturedNote = {
  timeMs: number
  freq: number
  durMs: number
  gain: number  // 0..1
  voice: 'melody' | 'bass' | 'arp' | 'perc-kick' | 'perc-hat'
}

export function encodeMidi(notes: CapturedNote[], bpm: number): Uint8Array
export function downloadMidi(bytes: Uint8Array, filename: string): void
```

- [ ] **Step 1: Write the failing test.**

`tests/audio/midiExport.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { encodeMidi, type CapturedNote } from '../../src/audio/midiExport'

describe('encodeMidi', () => {
  it('produces a valid MIDI Type-1 header for 4 tracks', () => {
    const bytes = encodeMidi([], 120)
    // MThd header
    expect(bytes[0]).toBe(0x4d) // M
    expect(bytes[1]).toBe(0x54) // T
    expect(bytes[2]).toBe(0x68) // h
    expect(bytes[3]).toBe(0x64) // d
    // chunk length = 6
    expect(bytes[4]).toBe(0); expect(bytes[5]).toBe(0); expect(bytes[6]).toBe(0); expect(bytes[7]).toBe(6)
    // format = 1
    expect(bytes[8]).toBe(0); expect(bytes[9]).toBe(1)
    // ntrks = 4
    expect(bytes[10]).toBe(0); expect(bytes[11]).toBe(4)
    // division = 480 ticks/quarter
    expect(bytes[12]).toBe(0x01); expect(bytes[13]).toBe(0xe0)
  })

  it('emits 4 MTrk chunks', () => {
    const bytes = encodeMidi([], 120)
    let count = 0
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0x4d && bytes[i + 1] === 0x54 && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x6b) count++
    }
    expect(count).toBe(4)
  })

  it('encodes a single melody note with correct pitch and velocity', () => {
    // 440 Hz = MIDI 69, gain 0.5 → velocity 64
    const notes: CapturedNote[] = [
      { timeMs: 0, freq: 440, durMs: 500, gain: 0.5, voice: 'melody' },
    ]
    const bytes = encodeMidi(notes, 120)
    // Look for note-on event 0x90 (channel 1) followed by pitch 69 and velocity 64.
    let found = false
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x90 && bytes[i + 1] === 69 && bytes[i + 2] === 64) { found = true; break }
    }
    expect(found).toBe(true)
  })

  it('routes percussion to channel 10 (status byte 0x99) with kick=36', () => {
    const notes: CapturedNote[] = [
      { timeMs: 0, freq: 0, durMs: 50, gain: 0.8, voice: 'perc-kick' },
    ]
    const bytes = encodeMidi(notes, 120)
    let found = false
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x99 && bytes[i + 1] === 36) { found = true; break }
    }
    expect(found).toBe(true)
  })

  it('encodes delta times in variable-length quantity', () => {
    // A note 1 beat in (= 480 ticks at division 480) at 120bpm = 500ms.
    const notes: CapturedNote[] = [
      { timeMs: 500, freq: 440, durMs: 100, gain: 0.5, voice: 'melody' },
    ]
    const bytes = encodeMidi(notes, 120)
    // VLQ for 480 = 0x83 0x60 (binary: 1_0000011 0_1100000).
    let found = false
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0x83 && bytes[i + 1] === 0x60) { found = true; break }
    }
    expect(found).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect failure.**
Run: `bun test tests/audio/midiExport.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/audio/midiExport.ts`.**

```ts
export type CapturedNote = {
  timeMs: number
  freq: number
  durMs: number
  gain: number
  voice: 'melody' | 'bass' | 'arp' | 'perc-kick' | 'perc-hat'
}

const DIVISION = 480

const VOICE_CHANNEL: Record<CapturedNote['voice'], number> = {
  melody: 0,
  bass: 1,
  arp: 2,
  'perc-kick': 9,   // channel 10 (0-indexed)
  'perc-hat': 9,
}

const PERC_PITCH: Record<'perc-kick' | 'perc-hat', number> = {
  'perc-kick': 36,
  'perc-hat': 42,
}

function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440))
}

function vlq(value: number): number[] {
  if (value < 0) value = 0
  const bytes: number[] = []
  let v = value & 0x0fffffff
  bytes.unshift(v & 0x7f)
  v >>= 7
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
    v >>= 7
  }
  return bytes
}

function msToTicks(ms: number, bpm: number): number {
  // ticks = (ms / 1000) * (bpm / 60) * DIVISION
  return Math.max(0, Math.round((ms * bpm * DIVISION) / 60000))
}

type TrackEvent = { absTick: number; bytes: number[] }

function buildTrack(events: TrackEvent[]): number[] {
  events.sort((a, b) => a.absTick - b.absTick)
  const out: number[] = []
  let lastTick = 0
  for (const ev of events) {
    const delta = ev.absTick - lastTick
    out.push(...vlq(delta), ...ev.bytes)
    lastTick = ev.absTick
  }
  // End-of-track meta event: delta=0, FF 2F 00.
  out.push(0, 0xff, 0x2f, 0)
  return out
}

function wrapTrack(body: number[]): number[] {
  const len = body.length
  return [
    0x4d, 0x54, 0x72, 0x6b,
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...body,
  ]
}

export function encodeMidi(notes: CapturedNote[], bpm: number): Uint8Array {
  const tracks: Record<'melody' | 'bass' | 'arp' | 'perc', TrackEvent[]> = {
    melody: [], bass: [], arp: [], perc: [],
  }
  for (const n of notes) {
    const ch = VOICE_CHANNEL[n.voice]
    const isPerc = n.voice === 'perc-kick' || n.voice === 'perc-hat'
    const pitch = isPerc ? PERC_PITCH[n.voice as 'perc-kick' | 'perc-hat'] : freqToMidi(n.freq)
    if (!isFinite(pitch) || pitch < 0 || pitch > 127) continue
    const vel = Math.max(1, Math.min(127, Math.round(n.gain * 127)))
    const onTick = msToTicks(n.timeMs, bpm)
    const offTick = msToTicks(n.timeMs + n.durMs, bpm)
    const trackKey = isPerc ? 'perc' : (n.voice as 'melody' | 'bass' | 'arp')
    tracks[trackKey].push({ absTick: onTick, bytes: [0x90 | ch, pitch, vel] })
    tracks[trackKey].push({ absTick: offTick, bytes: [0x80 | ch, pitch, 0] })
  }

  const trackBytes = [
    wrapTrack(buildTrack(tracks.melody)),
    wrapTrack(buildTrack(tracks.bass)),
    wrapTrack(buildTrack(tracks.arp)),
    wrapTrack(buildTrack(tracks.perc)),
  ]

  // Header: format=1, ntrks=4, division=480.
  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0, 0, 0, 6,
    0, 1,
    0, 4,
    (DIVISION >>> 8) & 0xff, DIVISION & 0xff,
  ]

  const out = new Uint8Array(header.length + trackBytes.reduce((s, t) => s + t.length, 0))
  out.set(header, 0)
  let off = header.length
  for (const t of trackBytes) { out.set(t, off); off += t.length }
  return out
}

export function downloadMidi(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run — expect pass.**
Run: `bun test tests/audio/midiExport.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit.**
```bash
git add src/audio/midiExport.ts tests/audio/midiExport.test.ts
git commit -m "feat(audio): MIDI Type-1 encoder for procedural music export"
```

---

### T3: Minimap window math (pure helper)

**Files:**
- Create: `src/ui/minimapWindow.ts`
- Create: `tests/ui/minimapWindow.test.ts`

**Goal:** Pure helper that computes which tile coords are inside the focused-mode window for a given hero pos + floor size + radius. Keeps minimap rendering simple in T11.

```ts
export type WindowRect = { x0: number; y0: number; x1: number; y1: number; width: number; height: number }
export function focusedWindow(hero: { x: number; y: number }, floorW: number, floorH: number, radius: number): WindowRect
```

- [ ] **Step 1: Write the failing test.**

`tests/ui/minimapWindow.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { focusedWindow } from '../../src/ui/minimapWindow'

describe('focusedWindow', () => {
  it('centers on hero away from edges', () => {
    const w = focusedWindow({ x: 20, y: 20 }, 60, 60, 8)
    expect(w).toEqual({ x0: 12, y0: 12, x1: 28, y1: 28, width: 17, height: 17 })
  })

  it('clamps left+top against floor edge', () => {
    const w = focusedWindow({ x: 2, y: 1 }, 60, 60, 8)
    expect(w.x0).toBe(0)
    expect(w.y0).toBe(0)
    expect(w.x1).toBe(8 + 2)  // hero_x + radius
    expect(w.y1).toBe(8 + 1)
  })

  it('clamps right+bottom against floor edge', () => {
    const w = focusedWindow({ x: 58, y: 59 }, 60, 60, 8)
    expect(w.x1).toBe(59)  // floorW - 1
    expect(w.y1).toBe(59)
  })

  it('reports inclusive width/height', () => {
    const w = focusedWindow({ x: 20, y: 20 }, 60, 60, 8)
    expect(w.width).toBe(w.x1 - w.x0 + 1)
    expect(w.height).toBe(w.y1 - w.y0 + 1)
  })
})
```

- [ ] **Step 2: Run — expect failure.**
Run: `bun test tests/ui/minimapWindow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/minimapWindow.ts`.**

```ts
export type WindowRect = { x0: number; y0: number; x1: number; y1: number; width: number; height: number }

export function focusedWindow(
  hero: { x: number; y: number },
  floorW: number,
  floorH: number,
  radius: number,
): WindowRect {
  const x0 = Math.max(0, hero.x - radius)
  const y0 = Math.max(0, hero.y - radius)
  const x1 = Math.min(floorW - 1, hero.x + radius)
  const y1 = Math.min(floorH - 1, hero.y + radius)
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}
```

- [ ] **Step 4: Run — expect pass.**
Run: `bun test tests/ui/minimapWindow.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit.**
```bash
git add src/ui/minimapWindow.ts tests/ui/minimapWindow.test.ts
git commit -m "feat(ui): minimap focused-window math helper"
```

---

## Wave 2 — Music engine (serial within wave, 4 tasks)

### T4: Bass + arpeggio + percussion voices

**Files:**
- Modify: `src/audio/music.ts`

**Goal:** Add three voices alongside the existing melody. Each voice plays on its own gain bus so we can mix later. No combat intensity yet — that's T5.

Replace the body of `createMusic` (keep the same `MusicHandle` shape):

```ts
export type MusicHandle = {
  start(): void
  stop(): void
  setVolume(v: number): void
  setMoodForDepth(depth: number): void
  // New: read-only access for combat-intensity polling and capture.
  // Both added in later tasks; keep the file small here by only adding fields used in T4.
}

type Mood = { scale: readonly number[]; bpm: number; root: number; bossHarmony: boolean }
const MOODS: Record<number, Mood> = {
  1: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220, bossHarmony: false },
  2: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220, bossHarmony: false },
  3: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 70, root: 220, bossHarmony: false },
  4: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 80, root: 196, bossHarmony: false },
  5: { scale: [0, 2, 3, 5, 7, 8, 11], bpm: 100, root: 220, bossHarmony: true },
}
```

Inside `createMusic(seed)`, add per-voice gain nodes wired to master:

```ts
const ctx = new AudioContext()
const master = ctx.createGain()
master.gain.value = 0
master.connect(ctx.destination)

const melodyGain = ctx.createGain(); melodyGain.gain.value = 1.0; melodyGain.connect(master)
const bassGain   = ctx.createGain(); bassGain.gain.value   = 0.4; bassGain.connect(master)
const arpGain    = ctx.createGain(); arpGain.gain.value    = 0.3; arpGain.connect(master)
const percGain   = ctx.createGain(); percGain.gain.value   = 0.3; percGain.connect(master)
const harmonyGain = ctx.createGain(); harmonyGain.gain.value = 0.0; harmonyGain.connect(master)
```

Replace the single `playNote` with voice-specific emitters:

```ts
function playMelody(freq: number, durMs: number): void {
  const osc = ctx.createOscillator(), env = ctx.createGain()
  osc.type = 'triangle'; osc.frequency.value = freq
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(melodyGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}

function playBass(freq: number, durMs: number): void {
  const osc = ctx.createOscillator(), env = ctx.createGain(), lp = ctx.createBiquadFilter()
  osc.type = 'sawtooth'; osc.frequency.value = freq
  lp.type = 'lowpass'; lp.frequency.value = 600
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(lp).connect(bassGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}

function playArp(freq: number, durMs: number): void {
  const osc = ctx.createOscillator(), env = ctx.createGain()
  osc.type = 'square'; osc.frequency.value = freq
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(arpGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}

function playPerc(kind: 'kick' | 'hat'): void {
  // Short noise burst through bandpass.
  const dur = kind === 'kick' ? 0.12 : 0.05
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
  bp.frequency.value = kind === 'kick' ? 80 : 7000
  bp.Q.value = kind === 'kick' ? 1 : 4
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.5, ctx.currentTime)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
  src.connect(bp).connect(env).connect(percGain)
  src.start()
}
```

Replace the `tick` loop with a 4-beat-bar scheduler:

```ts
function tick(now: number): void {
  if (!running) return
  if (now >= nextStepAt) {
    const beatMs = 60000 / mood.bpm
    const stepMs = beatMs / 2  // 8th-note grid

    // Melody — 60% chance per step, weighted toward lower scale degrees.
    if (rand() < 0.6) {
      const idx = Math.floor(rand() * rand() * mood.scale.length)
      const semi = mood.scale[idx]
      const octave = rand() < 0.2 ? 1 : 0
      playMelody(freqAt(mood.root, semi, octave), stepMs * 1.5)
    }

    // Bass on downbeat (every 8 steps).
    if (stepIdx % 8 === 0) {
      playBass(freqAt(mood.root, mood.scale[0], -1), beatMs * 4)
    }
    // Bass fifth on beat 3 (step 4 of the bar).
    if (stepIdx % 8 === 4) {
      playBass(freqAt(mood.root, mood.scale[4], -1), beatMs * 2)
    }

    // Arpeggio every other bar (16 steps), 4 ascending notes.
    const barStep = stepIdx % 16
    if (stepIdx % 32 < 16 && barStep % 2 === 0 && barStep < 8) {
      const arpIdx = barStep / 2
      const semi = mood.scale[arpIdx % mood.scale.length]
      playArp(freqAt(mood.root, semi, 1), stepMs)
    }

    // Percussion: kick on beats 1+3 (steps 0, 4), hat on offbeats (every odd step).
    if (stepIdx % 8 === 0 || stepIdx % 8 === 4) playPerc('kick')
    if (stepIdx % 2 === 1) playPerc('hat')

    stepIdx++
    nextStepAt = now + stepMs
  }
  requestAnimationFrame(tick)
}
```

- [ ] **Step 1:** Apply edits.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Full suite.**
Run: `bun test`
Expected: all green (no test depends on music internals).

- [ ] **Step 4: Manual smoke.**
Run: `bun run dev`. Open the app, click to unlock audio. Confirm you hear: melody (twinkly triangle), low bass on downbeats, occasional arpeggio runs, and steady kick + hi-hat. Close after ~10s.

- [ ] **Step 5: Commit.**
```bash
git add src/audio/music.ts
git commit -m "feat(audio): add bass, arpeggio, and percussion voices"
```

---

### T5: Combat intensity ducking

**Files:**
- Modify: `src/audio/music.ts`

**Goal:** Read the World on each music tick, find nearest alive enemy distance from hero, and smoothly bump tempo + perc/bass gains when ≤3 tiles away.

Add a `WorldRef` type and accept it in the constructor:

```ts
import type { World } from '../core/types'

export type MusicHandle = {
  start(): void
  stop(): void
  setVolume(v: number): void
  setMoodForDepth(depth: number): void
  setWorldRef(get: () => World): void
}
```

Inside `createMusic`:

```ts
let getWorld: (() => World) | null = null

function combatLevel(): 'explore' | 'combat' {
  if (!getWorld) return 'explore'
  const w = getWorld()
  const hero = w.actors[w.heroId]
  if (!hero || !hero.alive) return 'explore'
  let nearest = Infinity
  for (const a of Object.values(w.actors)) {
    if (a.id === w.heroId || !a.alive || a.kind !== 'enemy') continue
    const d = Math.max(Math.abs(a.pos.x - hero.pos.x), Math.abs(a.pos.y - hero.pos.y))
    if (d < nearest) nearest = d
  }
  return nearest <= 3 ? 'combat' : 'explore'
}

function applyMix(level: 'explore' | 'combat'): void {
  const t = ctx.currentTime
  const TC = 0.5  // time constant — ~1s smoothing
  if (level === 'combat') {
    bassGain.gain.setTargetAtTime(0.6, t, TC)
    percGain.gain.setTargetAtTime(0.7, t, TC)
  } else {
    bassGain.gain.setTargetAtTime(0.4, t, TC)
    percGain.gain.setTargetAtTime(0.3, t, TC)
  }
}

function effectiveBpm(): number {
  return combatLevel() === 'combat' ? mood.bpm * 1.25 : mood.bpm
}
```

Update `tick` to use `effectiveBpm()` and call `applyMix` once per step:

```ts
function tick(now: number): void {
  if (!running) return
  if (now >= nextStepAt) {
    const level = combatLevel()
    applyMix(level)
    const beatMs = 60000 / effectiveBpm()
    const stepMs = beatMs / 2
    // ... rest unchanged
    nextStepAt = now + stepMs
  }
  requestAnimationFrame(tick)
}
```

Add `setWorldRef` to the returned object:

```ts
return {
  start() { /* ... */ },
  stop() { /* ... */ },
  setVolume(v) { /* ... */ },
  setMoodForDepth(d) { mood = MOODS[d] ?? MOODS[5] },
  setWorldRef(get) { getWorld = get },
}
```

In `src/main.ts`, after creating the music handle, wire the world ref:

```ts
const music = createMusic(world.seed)
music.setMoodForDepth(world.run.depth)
music.setWorldRef(() => loop.getState())
```

- [ ] **Step 1:** Apply edits.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Full suite.**
Run: `bun test`
Expected: all green.

- [ ] **Step 4: Manual smoke.**
Run: `bun run dev`. In the app, walk near an enemy — confirm percussion gets noticeably louder and the rhythm feels faster. Walk away — confirm it eases back.

- [ ] **Step 5: Commit.**
```bash
git add src/audio/music.ts src/main.ts
git commit -m "feat(audio): combat-intensity ducking when enemies are nearby"
```

---

### T6: Boss harmony voice

**Files:**
- Modify: `src/audio/music.ts`

**Goal:** When `mood.bossHarmony === true` (depth 5), enable the harmony pad voice (sine, third above bass, half gain).

Add to `createMusic`:

```ts
function playHarmony(freq: number, durMs: number): void {
  const osc = ctx.createOscillator(), env = ctx.createGain()
  osc.type = 'sine'; osc.frequency.value = freq
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(harmonyGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}
```

In the `tick` body, when emitting bass on the downbeat, also emit harmony if the mood enables it:

```ts
if (stepIdx % 8 === 0) {
  playBass(freqAt(mood.root, mood.scale[0], -1), beatMs * 4)
  if (mood.bossHarmony) {
    // Third above the bass root (scale[2] is the minor third in our scales).
    playHarmony(freqAt(mood.root, mood.scale[2], 0), beatMs * 4)
  }
}
```

In `setMoodForDepth`, set the harmony bus gain at mood-change time:

```ts
setMoodForDepth(d) {
  mood = MOODS[d] ?? MOODS[5]
  harmonyGain.gain.setTargetAtTime(mood.bossHarmony ? 0.5 : 0.0, ctx.currentTime, 0.5)
}
```

- [ ] **Step 1:** Apply edits.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Full suite.**
Run: `bun test`
Expected: all green.

- [ ] **Step 4: Manual smoke.**
Run: `bun run dev`, open dev menu, hit "Descend" repeatedly to reach depth 5. Confirm a sustained sine pad enters under the bass on the boss floor.

- [ ] **Step 5: Commit.**
```bash
git add src/audio/music.ts
git commit -m "feat(audio): boss-floor harmony pad voice"
```

---

### T7: Capture buffer + getCapture

**Files:**
- Modify: `src/audio/music.ts`

**Goal:** Append every emitted note into a ring buffer so MIDI export can read it. Cleared on `setMoodForDepth`. Cap 4096; drop oldest on overflow.

Add to `MusicHandle`:

```ts
import type { CapturedNote } from './midiExport'

export type MusicHandle = {
  start(): void
  stop(): void
  setVolume(v: number): void
  setMoodForDepth(depth: number): void
  setWorldRef(get: () => World): void
  getCapture(): { notes: CapturedNote[]; bpm: number; depth: number }
}
```

Inside `createMusic`:

```ts
const CAPTURE_CAP = 4096
let captureStart = performance.now()
let capture: CapturedNote[] = []
let captureDepth = 1

function captureNote(voice: CapturedNote['voice'], freq: number, durMs: number, gain: number): void {
  if (capture.length >= CAPTURE_CAP) capture.shift()
  capture.push({ timeMs: performance.now() - captureStart, freq, durMs, gain, voice })
}
```

Wire each voice's emitter to call `captureNote` as the first line of the function body. The full new bodies (replacing the corresponding T4/T6 versions):

```ts
function playMelody(freq: number, durMs: number): void {
  captureNote('melody', freq, durMs, 0.08)
  const osc = ctx.createOscillator(), env = ctx.createGain()
  osc.type = 'triangle'; osc.frequency.value = freq
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(melodyGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}

function playBass(freq: number, durMs: number): void {
  captureNote('bass', freq, durMs, 0.12)
  const osc = ctx.createOscillator(), env = ctx.createGain(), lp = ctx.createBiquadFilter()
  osc.type = 'sawtooth'; osc.frequency.value = freq
  lp.type = 'lowpass'; lp.frequency.value = 600
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(lp).connect(bassGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}

function playArp(freq: number, durMs: number): void {
  captureNote('arp', freq, durMs, 0.06)
  const osc = ctx.createOscillator(), env = ctx.createGain()
  osc.type = 'square'; osc.frequency.value = freq
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(arpGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}

function playPerc(kind: 'kick' | 'hat'): void {
  const voice: CapturedNote['voice'] = kind === 'kick' ? 'perc-kick' : 'perc-hat'
  captureNote(voice, 0, kind === 'kick' ? 120 : 50, 0.5)
  const dur = kind === 'kick' ? 0.12 : 0.05
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
  bp.frequency.value = kind === 'kick' ? 80 : 7000
  bp.Q.value = kind === 'kick' ? 1 : 4
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.5, ctx.currentTime)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
  src.connect(bp).connect(env).connect(percGain)
  src.start()
}

function playHarmony(freq: number, durMs: number): void {
  // Harmony reuses 'bass' track for MIDI export (no separate channel allocated).
  captureNote('bass', freq, durMs, 0.06)
  const osc = ctx.createOscillator(), env = ctx.createGain()
  osc.type = 'sine'; osc.frequency.value = freq
  env.gain.setValueAtTime(0, ctx.currentTime)
  env.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1)
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.connect(env).connect(harmonyGain)
  osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
}
```

Reset capture on mood change:

```ts
setMoodForDepth(d) {
  mood = MOODS[d] ?? MOODS[5]
  harmonyGain.gain.setTargetAtTime(mood.bossHarmony ? 0.5 : 0.0, ctx.currentTime, 0.5)
  capture = []
  captureStart = performance.now()
  captureDepth = d
}
```

Expose via `getCapture`:

```ts
return {
  // ...existing methods...
  getCapture() {
    return { notes: capture.slice(), bpm: mood.bpm, depth: captureDepth }
  },
}
```

- [ ] **Step 1:** Apply edits.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Manual smoke.**
Run: `bun run dev`. Confirm the build still loads and music still plays. The capture is invisible to the user until T17 wires the export button — this step just confirms no runtime regression from the buffer plumbing.

- [ ] **Step 4: Commit.**
```bash
git add src/audio/music.ts
git commit -m "feat(audio): capture emitted notes for MIDI export"
```

---

## Wave 3 — Layout shell (serial within wave, 5 tasks)

### T8: HTML grid + side panel scaffolding

**Files:**
- Modify: `index.html`

**Goal:** Replace the full-screen canvas overlay with a CSS-grid layout: `1fr 280px`. Add `#side-panel` container.

Replace the `<style>` block contents with:

```html
<style>
  :root {
    --bone: #eadbc0;
    --deep: #2a1a3e;
    --deep-dark: #1a1024;
    --amber: #f0b770;
    --void: #0b0612;
    --panel-bg: #14091e;
    --panel-border: #5a3e8a;
  }
  html, body { margin: 0; height: 100%; background: var(--void); color: var(--bone); font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .font-gothic { font-family: 'UnifrakturMaguntia', ui-serif, Georgia, serif; letter-spacing: 0.03em; }

  #stage {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    display: grid;
    grid-template-columns: 1fr 280px;
    grid-template-rows: 1fr;
  }
  #play {
    position: relative;
    overflow: hidden;
  }
  #world, #fx {
    position: absolute; inset: 0; width: 100%; height: 100%; display: block;
  }
  #world { z-index: 1; image-rendering: pixelated; }
  #fx    { z-index: 2; pointer-events: none; }

  #side-panel {
    background: var(--panel-bg);
    border-left: 1px solid var(--panel-border);
    overflow-y: auto;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    box-sizing: border-box;
  }

  /* Modal overlays still float above everything */
  #modal-layer { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
  #modal-layer > * { pointer-events: auto; }

  @media (max-width: 768px) {
    #stage {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }
    #side-panel {
      border-left: none;
      border-top: 1px solid var(--panel-border);
      max-height: 50vh;
    }
  }
</style>
```

And replace the body inner:

```html
<div id="stage">
  <div id="play">
    <canvas id="world" width="960" height="720"></canvas>
    <canvas id="fx"    width="960" height="720"></canvas>
  </div>
  <div id="side-panel"></div>
  <div id="modal-layer"></div>
</div>
```

- [ ] **Step 1:** Apply the edit.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean (HTML only).

- [ ] **Step 3: Manual smoke.**
Run: `bun run dev`. Open the app. Confirm canvas fills the left region and a dark vertical strip is visible on the right (empty for now). Resize browser to <768px wide → strip moves to the bottom.

- [ ] **Step 4: Commit.**
```bash
git add index.html
git commit -m "feat(ui): grid layout with side panel + modal layer"
```

---

### T9: Side-panel mount module

**Files:**
- Create: `src/ui/sidePanel.ts`

**Goal:** Tiny module that exposes a panel root + named slot subdivisions. Other widget modules render into named slots so order + spacing is centralized.

```ts
export type SidePanel = {
  root: HTMLElement
  slot(name: 'minimap' | 'stats' | 'equipment' | 'inventory' | 'music' | 'descend'): HTMLElement
}

export function mountSidePanel(parent: HTMLElement): SidePanel {
  const slots: Record<string, HTMLElement> = {}
  const order = ['minimap', 'stats', 'equipment', 'inventory', 'music', 'descend'] as const
  for (const name of order) {
    const el = document.createElement('div')
    el.dataset.slot = name
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '6px'
    parent.appendChild(el)
    slots[name] = el
  }
  return {
    root: parent,
    slot(name) { return slots[name] },
  }
}
```

- [ ] **Step 1:** Create the file.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
git add src/ui/sidePanel.ts
git commit -m "feat(ui): side-panel mount with named slots"
```

---

### T10: Refactor HUD to render in stats slot

**Files:**
- Modify: `src/ui/hud.ts`

**Goal:** Drop floating top-bar positioning. Render HP bar + ATK/DEF/Depth as a vertical stat block inside the `stats` slot. Log panel stays bottom-left of the play canvas (it's narrative, not panel data).

Replace `mountHud`:

```ts
import { Tile, type World } from '../core/types'
import { effectiveAtk, effectiveDef } from '../core/selectors'

export type Hud = {
  update(state: World): void
  root: HTMLElement
  onDescend(cb: () => void): void
  descendButton(): HTMLElement
}

export function mountHud(statsSlot: HTMLElement, descendSlot: HTMLElement, logParent: HTMLElement): Hud {
  // === Stats block (in side panel) ===
  const root = document.createElement('div')
  Object.assign(root.style, {
    background: 'rgba(11, 6, 18, 0.78)',
    border: '1px solid #5a3e8a',
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '13px',
    color: '#eadbc0',
    fontVariantNumeric: 'tabular-nums',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  statsSlot.appendChild(root)

  // HP row
  const hpBox = document.createElement('div')
  Object.assign(hpBox.style, { display: 'flex', alignItems: 'center', gap: '6px' } satisfies Partial<CSSStyleDeclaration>)
  const hpBarOuter = document.createElement('div')
  Object.assign(hpBarOuter.style, {
    flex: '1', height: '10px', background: '#1a1024',
    border: '1px solid #3e2a5c', borderRadius: '5px', overflow: 'hidden',
  } satisfies Partial<CSSStyleDeclaration>)
  const hpBarInner = document.createElement('div')
  Object.assign(hpBarInner.style, {
    height: '100%', background: 'linear-gradient(90deg, #e0bdf7, #b7a3d9)',
    width: '100%', transition: 'width 120ms ease-out',
  } satisfies Partial<CSSStyleDeclaration>)
  hpBarOuter.appendChild(hpBarInner)
  const hpText = document.createElement('span')
  hpText.style.minWidth = '54px'
  hpText.textContent = 'HP 20/20'
  hpBox.appendChild(hpBarOuter)
  hpBox.appendChild(hpText)
  root.appendChild(hpBox)

  // Stats row (atk/def/depth)
  const statsRow = document.createElement('div')
  Object.assign(statsRow.style, { display: 'flex', justifyContent: 'space-between' } satisfies Partial<CSSStyleDeclaration>)
  const atkStat = makeStat('⚔', '4')
  const defStat = makeStat('🛡', '1')
  const depthStat = makeStat('⬇', '1/5')
  statsRow.appendChild(atkStat.el)
  statsRow.appendChild(defStat.el)
  statsRow.appendChild(depthStat.el)
  root.appendChild(statsRow)

  // === Descend button (in panel descend slot) ===
  const descendBtn = document.createElement('button')
  descendBtn.type = 'button'
  descendBtn.textContent = 'Descend ↓'
  Object.assign(descendBtn.style, {
    width: '100%',
    background: '#5a3e8a',
    color: '#f5e6b0',
    border: '1px solid #f0b770',
    borderRadius: '6px',
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'none',
    boxShadow: '0 0 12px rgba(240, 183, 112, 0.4)',
  } satisfies Partial<CSSStyleDeclaration>)
  descendSlot.appendChild(descendBtn)

  // === Log panel (floats over the play area, bottom-left) ===
  const logPanel = document.createElement('div')
  Object.assign(logPanel.style, {
    position: 'absolute',
    left: '12px',
    bottom: '12px',
    maxWidth: '280px',
    maxHeight: '110px',
    overflow: 'hidden',
    fontSize: '11px',
    fontFamily: 'ui-monospace, monospace',
    color: 'rgba(234, 219, 192, 0.85)',
    textShadow: '0 1px 2px rgba(0,0,0,0.85)',
    pointerEvents: 'none',
    zIndex: '3',
  } satisfies Partial<CSSStyleDeclaration>)
  logParent.appendChild(logPanel)

  let descendCb: (() => void) | null = null
  descendBtn.addEventListener('click', () => { descendCb?.() })

  const NOISE_PREFIXES = ['turn advance', 'hero intent', 'hero path']
  const FADE_LIFE_MS = 6000
  const MAX_VISIBLE_LINES = 5
  const OVERFLOW_EVICT_MS = 500
  type LogLine = { key: string; text: string; bornAt: number; el: HTMLDivElement }
  const liveLines: LogLine[] = []
  let lastLogLen = 0

  function update(state: World): void {
    const hero = state.actors[state.heroId]
    if (hero) {
      hpText.textContent = `HP ${Math.max(0, hero.hp)}/${hero.maxHp}`
      const ratio = Math.max(0, Math.min(1, hero.hp / hero.maxHp))
      hpBarInner.style.width = `${(ratio * 100).toFixed(0)}%`
      hpBarInner.style.background = ratio < 0.3
        ? 'linear-gradient(90deg, #b7323e, #7a1f2e)'
        : ratio < 0.6
          ? 'linear-gradient(90deg, #f0b770, #b7753e)'
          : 'linear-gradient(90deg, #e0bdf7, #b7a3d9)'
      atkStat.setValue(String(effectiveAtk(state, state.heroId)))
      defStat.setValue(String(effectiveDef(state, state.heroId)))
    }
    depthStat.setValue(`${state.run.depth}/5`)

    const heroOnStairs = hero && hero.alive
      && state.floor.tiles[hero.pos.y * state.floor.width + hero.pos.x] === Tile.Stairs
    descendBtn.style.display = heroOnStairs ? 'block' : 'none'

    if (state.log.length !== lastLogLen) {
      const now = performance.now()
      for (let i = lastLogLen; i < state.log.length; i++) {
        const entry = state.log[i]
        if (NOISE_PREFIXES.some(p => entry.text.startsWith(p))) continue
        const el = document.createElement('div')
        el.textContent = entry.text
        Object.assign(el.style, {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'opacity 200ms linear',
        } satisfies Partial<CSSStyleDeclaration>)
        logPanel.appendChild(el)
        liveLines.push({ key: `${entry.tick}-${i}`, text: entry.text, bornAt: now, el })
      }
      lastLogLen = state.log.length
    }

    const now = performance.now()
    const overflow = liveLines.length - MAX_VISIBLE_LINES
    if (overflow > 0) {
      const forcedBornAt = now - (FADE_LIFE_MS - OVERFLOW_EVICT_MS)
      for (let i = 0; i < overflow; i++) {
        const line = liveLines[i]
        if (line.bornAt > forcedBornAt) line.bornAt = forcedBornAt
      }
    }
    for (let i = liveLines.length - 1; i >= 0; i--) {
      const line = liveLines[i]
      const age = now - line.bornAt
      if (age >= FADE_LIFE_MS) {
        line.el.remove()
        liveLines.splice(i, 1)
        continue
      }
      const held = FADE_LIFE_MS * 0.4
      const opacity = age < held ? 1 : 1 - (age - held) / (FADE_LIFE_MS - held)
      line.el.style.opacity = opacity.toFixed(3)
    }
  }

  return {
    root,
    update,
    onDescend(cb) { descendCb = cb },
    descendButton() { return descendBtn },
  }
}

function makeStat(icon: string, initialValue: string): { el: HTMLElement; setValue: (v: string) => void } {
  const el = document.createElement('div')
  Object.assign(el.style, { display: 'flex', alignItems: 'center', gap: '4px' } satisfies Partial<CSSStyleDeclaration>)
  const iconEl = document.createElement('span')
  iconEl.textContent = icon
  iconEl.style.fontSize = '13px'
  const valueEl = document.createElement('span')
  valueEl.textContent = initialValue
  valueEl.style.minWidth = '18px'
  el.appendChild(iconEl)
  el.appendChild(valueEl)
  return {
    el,
    setValue(v: string) { if (valueEl.textContent !== v) valueEl.textContent = v },
  }
}
```

- [ ] **Step 1:** Apply edits. (We will rewire `main.ts` in T14 — file may not run cleanly between tasks, that's fine.)

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: errors in `main.ts` (signature changed). Document them, do NOT fix yet — T14 fixes wiring.

- [ ] **Step 3: Commit.**
```bash
git add src/ui/hud.ts
git commit -m "refactor(ui): HUD as side-panel stat block (wiring fix in T14)"
```

---

### T11: Restructure inventory + minimap into panel slots

**Files:**
- Modify: `src/ui/inventory.ts`
- Modify: `src/ui/minimap.ts`

**Goal:** Inventory becomes a 2×3 grid + equipment row inside its panel slot. Minimap mounts into its panel slot, accepts a zoom-mode + click handler, and uses `focusedWindow` from T3.

**`src/ui/inventory.ts` — replace `mountInventory`:**

```ts
import type { World, Action, Item } from '../core/types'

export type InventoryMount = {
  root: HTMLElement
  update(state: World): void
}

export function mountInventory(equipSlot: HTMLElement, invSlot: HTMLElement, onAction: (a: Action) => void): InventoryMount {
  // Equipment row (2 slots side by side)
  const equipRow = document.createElement('div')
  Object.assign(equipRow.style, { display: 'flex', gap: '6px', justifyContent: 'center' } satisfies Partial<CSSStyleDeclaration>)
  equipSlot.appendChild(equipRow)

  // Inventory grid (2 rows × 3 cols)
  const invGrid = document.createElement('div')
  Object.assign(invGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  invSlot.appendChild(invGrid)

  let lastKey = ''

  function makeSlot(label: string): { el: HTMLDivElement; setItem(item: Item | null): void; onClick(cb: () => void): void } {
    const el = document.createElement('div')
    Object.assign(el.style, {
      width: '52px', height: '52px',
      border: '1px solid #5a3e8a',
      borderRadius: '6px',
      background: 'rgba(11, 6, 18, 0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'ui-monospace, monospace', fontSize: '10px',
      color: '#c9b3e8',
      cursor: 'pointer',
      textAlign: 'center',
      padding: '2px',
    } satisfies Partial<CSSStyleDeclaration>)
    let onClickCb: (() => void) | null = null
    el.addEventListener('mousedown', e => { e.preventDefault(); onClickCb?.() })
    return {
      el,
      setItem(item) {
        el.title = item ? item.name : `(${label})`
        el.textContent = item ? item.name.slice(0, 6) : ''
      },
      onClick(cb) { onClickCb = cb },
    }
  }

  const weaponSlot = makeSlot('weapon')
  const armorSlot = makeSlot('armor')
  equipRow.appendChild(weaponSlot.el)
  equipRow.appendChild(armorSlot.el)

  const invSlots = Array.from({ length: 6 }, () => makeSlot(''))
  for (const s of invSlots) invGrid.appendChild(s.el)

  function update(state: World): void {
    const key = JSON.stringify({
      w: state.equipment.weapon?.instanceId ?? '',
      a: state.equipment.armor?.instanceId ?? '',
      inv: state.inventory.map(i => i.instanceId),
    })
    if (key === lastKey) return
    lastKey = key

    weaponSlot.setItem(state.equipment.weapon)
    weaponSlot.onClick(() => { if (state.equipment.weapon) onAction({ type: 'UnequipItem', slot: 'weapon' }) })
    armorSlot.setItem(state.equipment.armor)
    armorSlot.onClick(() => { if (state.equipment.armor) onAction({ type: 'UnequipItem', slot: 'armor' }) })

    for (let i = 0; i < 6; i++) {
      const item = state.inventory[i] ?? null
      invSlots[i].setItem(item)
      invSlots[i].onClick(() => {
        if (!item) return
        if (item.body.kind === 'potion') onAction({ type: 'UseItem', instanceId: item.instanceId })
        else onAction({ type: 'EquipItem', instanceId: item.instanceId })
      })
    }
  }

  return { root: equipSlot, update }
}
```

**`src/ui/minimap.ts` — replace contents:**

```ts
import { Tile, type World } from '../core/types'
import { palette } from '../content/palette'
import { focusedWindow, type WindowRect } from './minimapWindow'

export type MinimapMode = 'focused' | 'full'
export type Minimap = {
  root: HTMLElement
  update(state: World, seenTiles: Uint8Array | null, revealMap: boolean): void
  setMode(mode: MinimapMode): void
  getMode(): MinimapMode
}

const MINIMAP_SCALE = 4
const FOCUSED_RADIUS = 8

export function mountMinimap(parent: HTMLElement): Minimap {
  const wrapper = document.createElement('div')
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  } satisfies Partial<CSSStyleDeclaration>)
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  Object.assign(canvas.style, {
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    background: 'rgba(11, 6, 18, 0.85)',
    imageRendering: 'pixelated',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>)
  wrapper.appendChild(canvas)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.textContent = 'Zoom: focused'
  Object.assign(toggle.style, {
    background: '#2a1a3e',
    color: '#eadbc0',
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    padding: '4px 8px',
    fontFamily: 'inherit',
    fontSize: '11px',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>)
  wrapper.appendChild(toggle)
  parent.appendChild(wrapper)

  const ctx = canvas.getContext('2d')!
  let mode: MinimapMode = 'full'
  let lastSize = { w: 0, h: 0 }
  let lastFloorKey = ''

  function setLabel() { toggle.textContent = `Zoom: ${mode}` }
  setLabel()

  function setMode(next: MinimapMode) { mode = next; setLabel() }

  canvas.addEventListener('click', () => setMode(mode === 'focused' ? 'full' : 'focused'))
  toggle.addEventListener('click', () => setMode(mode === 'focused' ? 'full' : 'focused'))

  function resizeIfNeeded(w: number, h: number) {
    const px = w * MINIMAP_SCALE
    const py = h * MINIMAP_SCALE
    if (lastSize.w !== px || lastSize.h !== py) {
      canvas.width = px
      canvas.height = py
      canvas.style.width = `${px}px`
      canvas.style.height = `${py}px`
      lastSize = { w: px, h: py }
    }
  }

  function update(state: World, seenTiles: Uint8Array | null, revealMap: boolean): void {
    const { floor } = state
    // Auto-pick mode on first encounter with this floor: large floors → focused, small → full.
    const floorKey = `${state.seed}:${state.run.depth}`
    if (floorKey !== lastFloorKey) {
      mode = floor.width > 40 ? 'focused' : 'full'
      setLabel()
      lastFloorKey = floorKey
    }

    const hero = state.actors[state.heroId]
    let win: WindowRect
    if (mode === 'focused' && hero) {
      win = focusedWindow(hero.pos, floor.width, floor.height, FOCUSED_RADIUS)
    } else {
      win = { x0: 0, y0: 0, x1: floor.width - 1, y1: floor.height - 1, width: floor.width, height: floor.height }
    }
    resizeIfNeeded(win.width, win.height)

    ctx.fillStyle = palette.obsidianBlack
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const everythingVisible = revealMap || !seenTiles

    for (let y = win.y0; y <= win.y1; y++) {
      for (let x = win.x0; x <= win.x1; x++) {
        const idx = y * floor.width + x
        if (!everythingVisible && !seenTiles[idx]) continue
        const t = floor.tiles[idx]
        let color: string | null = null
        if (t === Tile.Floor) color = palette.deepPurpleLite
        else if (t === Tile.Wall) color = palette.deepPurple
        else if (t === Tile.Stairs) color = palette.silkFlameAmber
        else if (t === Tile.Shrine) color = palette.bloodCrimson
        if (color) {
          ctx.fillStyle = color
          ctx.fillRect((x - win.x0) * MINIMAP_SCALE, (y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
        }
      }
    }

    function inWindow(p: { x: number; y: number }): boolean {
      return p.x >= win.x0 && p.x <= win.x1 && p.y >= win.y0 && p.y <= win.y1
    }

    for (const item of state.droppedItems) {
      if (!inWindow(item.pos)) continue
      const idx = item.pos.y * floor.width + item.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect((item.pos.x - win.x0) * MINIMAP_SCALE, (item.pos.y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }
    for (const ground of state.groundItems) {
      if (!inWindow(ground.pos)) continue
      const idx = ground.pos.y * floor.width + ground.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect((ground.pos.x - win.x0) * MINIMAP_SCALE, (ground.pos.y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }
    for (const scroll of state.loreScrolls) {
      if (!inWindow(scroll.pos)) continue
      const idx = scroll.pos.y * floor.width + scroll.pos.x
      if (!everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = palette.silkFlameAmber
      ctx.fillRect((scroll.pos.x - win.x0) * MINIMAP_SCALE, (scroll.pos.y - win.y0) * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
    }

    for (const a of Object.values(state.actors)) {
      if (!a.alive) continue
      const isHero = a.id === state.heroId
      if (!inWindow(a.pos)) continue
      const idx = a.pos.y * floor.width + a.pos.x
      if (!isHero && !everythingVisible && !seenTiles![idx]) continue
      ctx.fillStyle = isHero ? palette.boneWhite : palette.bloodCrimson
      const px = (a.pos.x - win.x0) * MINIMAP_SCALE - 1
      const py = (a.pos.y - win.y0) * MINIMAP_SCALE - 1
      ctx.fillRect(px, py, MINIMAP_SCALE + 2, MINIMAP_SCALE + 2)
    }
  }

  return { root: wrapper, update, setMode, getMode: () => mode }
}
```

- [ ] **Step 1:** Apply edits.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: errors in `main.ts` (signature changes). Defer fix to T14.

- [ ] **Step 3: Commit.**
```bash
git add src/ui/inventory.ts src/ui/minimap.ts
git commit -m "refactor(ui): inventory 2x3 + minimap zoom-mode in side panel"
```

---

### T12: Music controls widget

**Files:**
- Create: `src/ui/musicControls.ts`

**Goal:** Self-contained widget that mounts a play/pause button + volume slider into a parent. Reads/writes localStorage. Calls into a `MusicHandle`-like interface.

```ts
type Controlled = {
  start(): void
  stop(): void
  setVolume(v: number): void
}

export type MusicControls = {
  root: HTMLElement
  setMuted(muted: boolean): void  // for blur-mute integration
}

const KEY_PLAYING = 'music_playing'
const KEY_VOLUME = 'music_volume'

export function mountMusicControls(parent: HTMLElement, music: Controlled): MusicControls {
  const root = document.createElement('div')
  Object.assign(root.style, {
    background: 'rgba(11, 6, 18, 0.6)',
    border: '1px solid #5a3e8a',
    borderRadius: '6px',
    padding: '6px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>)
  parent.appendChild(root)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  Object.assign(toggle.style, {
    background: '#2a1a3e',
    color: '#eadbc0',
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>)

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '100'
  slider.style.flex = '1'

  root.appendChild(toggle)
  root.appendChild(slider)

  // Restore persisted state.
  const persistedPlay = localStorage.getItem(KEY_PLAYING)
  const persistedVol = localStorage.getItem(KEY_VOLUME)
  let playing = persistedPlay === null ? true : persistedPlay === 'true'
  let volume = persistedVol === null ? 50 : Math.max(0, Math.min(100, Number(persistedVol)))
  let muted = false

  slider.value = String(volume)

  function effectiveVolume(): number {
    return (playing && !muted) ? (volume / 100) * 0.5 : 0
  }
  function applyVolume(): void { music.setVolume(effectiveVolume()) }

  function setPlaying(next: boolean): void {
    playing = next
    localStorage.setItem(KEY_PLAYING, String(playing))
    toggle.textContent = playing ? '⏸ Pause' : '▶ Play'
    if (playing) music.start()
    applyVolume()
  }

  toggle.addEventListener('click', () => setPlaying(!playing))
  slider.addEventListener('input', () => {
    volume = Number(slider.value)
    localStorage.setItem(KEY_VOLUME, String(volume))
    applyVolume()
  })

  setPlaying(playing)

  return {
    root,
    setMuted(next: boolean) { muted = next; applyVolume() },
  }
}
```

- [ ] **Step 1:** Create the file.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean for this file.

- [ ] **Step 3: Commit.**
```bash
git add src/ui/musicControls.ts
git commit -m "feat(ui): music play/pause + volume control widget"
```

---

## Wave 4 — Wiring + canvas resize (serial, 3 tasks)

### T13: Canvas resize observer

**Files:**
- Modify: `src/main.ts`

**Goal:** Pin canvas internal pixel size to its CSS pixel size on resize so the renderer keeps integer pixels and isn't blurry.

After acquiring `worldCanvas` and `fxCanvas` in `main()`, add:

```ts
function resizeCanvases(): void {
  const playEl = document.getElementById('play') as HTMLElement
  const w = Math.max(64, Math.floor(playEl.clientWidth))
  const h = Math.max(64, Math.floor(playEl.clientHeight))
  for (const c of [worldCanvas, fxCanvas]) {
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
  }
}

resizeCanvases()
new ResizeObserver(resizeCanvases).observe(document.getElementById('play') as HTMLElement)
```

- [ ] **Step 1:** Apply edit.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: still has T10/T11 errors plus possibly new ones — track but defer.

- [ ] **Step 3: Commit.**
```bash
git add src/main.ts
git commit -m "feat(ui): resize canvases to play-cell on layout change"
```

---

### T14: Rewire main.ts to side panel

**Files:**
- Modify: `src/main.ts`

**Goal:** Replace the legacy `mountHud(hudContainer)` call site with the new mounts. Wire side panel slots to HUD/inventory/minimap/musicControls. Move dialog + itemReward + devMenu into `#modal-layer`.

Around the existing imports + mount block, swap to:

```ts
import { mountSidePanel } from './ui/sidePanel'
import { mountMusicControls } from './ui/musicControls'
// (other imports unchanged)
```

Replace the block after `wireAudio(...)`:

```ts
const music = createMusic(world.seed)
music.setMoodForDepth(world.run.depth)
music.setWorldRef(() => loop.getState())
flags.subscribe(next => { music.setVolume(next.volume * 0.5) })

const sidePanelEl = document.getElementById('side-panel') as HTMLDivElement
const playEl = document.getElementById('play') as HTMLDivElement
const modalEl = document.getElementById('modal-layer') as HTMLDivElement

const panel = mountSidePanel(sidePanelEl)
const minimap = mountMinimap(panel.slot('minimap'))
const hud = mountHud(panel.slot('stats'), panel.slot('descend'), playEl)
const inventory = mountInventory(panel.slot('equipment'), panel.slot('inventory'), (a) => loop.submit(a))
const musicCtl = mountMusicControls(panel.slot('music'), music)
hud.onDescend(() => loop.submit({ type: 'Descend' }))

const overlay = mountOverlay(modalEl)
const dialog = mountDialog(modalEl, (a) => loop.submit(a))
const itemReward = mountItemReward(modalEl, (a) => loop.submit(a))
const devMenu = mountDevMenu(modalEl, flags)
devMenu.setRunId(runId)
attachDevMenuHotkey(devMenu)
```

Remove the now-unused `hudContainer` lookup (the old `<div id="hud">` is gone — index.html no longer has it).

- [ ] **Step 1:** Apply edits.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Full suite.**
Run: `bun test`
Expected: all green.

- [ ] **Step 4: Manual smoke.**
Run: `bun run dev`. Confirm:
- HUD stat block renders in side panel (HP bar, ATK/DEF/Depth).
- Inventory shows 2×3 grid + equipment row.
- Minimap renders with a "Zoom" toggle button below it.
- Music controls widget shows play/pause + volume slider.
- Hero clicks land on canvas (not blocked by panel anymore).
- Dialog/reward modals still center over canvas.

- [ ] **Step 5: Commit.**
```bash
git add src/main.ts
git commit -m "feat(ui): wire side panel — HUD, minimap, inventory, music controls"
```

---

### T15: Visibility-blur muting

**Files:**
- Modify: `src/main.ts`

**Goal:** Mute music when the tab loses visibility, unmute on regain.

After `mountMusicControls`:

```ts
document.addEventListener('visibilitychange', () => {
  musicCtl.setMuted(document.hidden)
})
```

- [ ] **Step 1:** Apply edit.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Manual smoke.**
Run: `bun run dev`. Click in window to start music. Switch to another tab → music goes silent. Switch back → it returns.

- [ ] **Step 4: Commit.**
```bash
git add src/main.ts
git commit -m "feat(ui): mute music while tab is hidden"
```

---

## Wave 5 — Mobile + MIDI export + smoke (serial, 3 tasks)

### T16: Mobile drawer + touch input

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ui/sidePanel.ts`

**Goal:** On mobile (≤768px wide), wrap the panel content in a collapsible drawer. Add `touchstart` on canvas that translates to a synthetic click.

**`src/ui/sidePanel.ts` — add drawer support:**

Update the module to optionally render a header strip that toggles drawer state when the responsive observer says we're mobile.

```ts
import type { Responsive } from '../dev/responsive'

const KEY_DRAWER = 'hud_drawer'
type DrawerState = 'expanded' | 'collapsed'

export type SidePanel = {
  root: HTMLElement
  slot(name: 'minimap' | 'stats' | 'equipment' | 'inventory' | 'music' | 'descend'): HTMLElement
}

export function mountSidePanel(parent: HTMLElement, responsive?: Responsive): SidePanel {
  // Header strip — only used in mobile drawer mode.
  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'none',  // shown when isMobile()
    cursor: 'pointer',
    padding: '6px 10px',
    background: '#2a1a3e',
    borderBottom: '1px solid #5a3e8a',
    textAlign: 'center',
    fontSize: '12px',
    color: '#eadbc0',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  header.textContent = '▾ Tap to collapse'
  parent.appendChild(header)

  // Body holds the slots; we hide it when collapsed.
  const body = document.createElement('div')
  Object.assign(body.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto',
  } satisfies Partial<CSSStyleDeclaration>)
  parent.appendChild(body)

  const slots: Record<string, HTMLElement> = {}
  const order = ['minimap', 'stats', 'equipment', 'inventory', 'music', 'descend'] as const
  for (const name of order) {
    const el = document.createElement('div')
    el.dataset.slot = name
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '6px'
    body.appendChild(el)
    slots[name] = el
  }

  const persisted = localStorage.getItem(KEY_DRAWER)
  let drawer: DrawerState = persisted === 'collapsed' ? 'collapsed' : 'expanded'

  function applyMobileState(isMobile: boolean): void {
    if (isMobile) {
      header.style.display = 'block'
      const collapsed = drawer === 'collapsed'
      body.style.display = collapsed ? 'none' : 'flex'
      header.textContent = collapsed ? '▴ Tap to expand' : '▾ Tap to collapse'
    } else {
      header.style.display = 'none'
      body.style.display = 'flex'
    }
  }

  header.addEventListener('click', () => {
    drawer = drawer === 'expanded' ? 'collapsed' : 'expanded'
    localStorage.setItem(KEY_DRAWER, drawer)
    applyMobileState(true)
  })

  if (responsive) {
    applyMobileState(responsive.isMobile())
    responsive.subscribe(applyMobileState)
  } else {
    applyMobileState(false)
  }

  return {
    root: parent,
    slot(name) { return slots[name] },
  }
}
```

**`src/main.ts` — wire responsive + touch:**

Add to imports:
```ts
import { createResponsive } from './dev/responsive'
```

Before `mountSidePanel`:
```ts
const responsive = createResponsive()
const panel = mountSidePanel(sidePanelEl, responsive)
```

After canvas-click input is attached (`attachDevInput(...)`), add touch translation on the play wrapper:

```ts
playEl.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return
  e.preventDefault()
  const t = e.touches[0]
  const synth = new MouseEvent('click', {
    bubbles: true, cancelable: true,
    clientX: t.clientX, clientY: t.clientY,
    button: 0,
  })
  worldCanvas.dispatchEvent(synth)
}, { passive: false })
```

- [ ] **Step 1:** Apply edits.

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Full suite.**
Run: `bun test`
Expected: all green.

- [ ] **Step 4: Manual smoke.**
Run: `bun run dev`. Resize browser to <768px wide → header strip appears, tap collapses panel. Tap again expands. Resize wider → header hides, panel always expanded.

- [ ] **Step 5: Commit.**
```bash
git add src/main.ts src/ui/sidePanel.ts
git commit -m "feat(ui): mobile drawer + touch-to-click bridge on canvas"
```

---

### T17: MIDI export button in dev menu

**Files:**
- Modify: `src/ui/devMenu.ts`
- Modify: `src/main.ts`

**Goal:** Add a button to the dev menu that grabs the current music capture, encodes it as MIDI, and triggers a download. Visible whenever the dev menu itself is.

**`src/ui/devMenu.ts` — add button + callback hook:**

Find the `mountDevMenu` function and add a new button rendered next to the existing controls. The dev menu currently exposes a `setRunId` method; extend it with `onExportMidi(cb)`.

```ts
export type DevMenu = {
  // ...existing fields...
  onExportMidi(cb: () => void): void
}
```

Inside `mountDevMenu`:

```ts
const exportBtn = document.createElement('button')
exportBtn.type = 'button'
exportBtn.textContent = 'Export MIDI'
Object.assign(exportBtn.style, {
  background: '#2a1a3e',
  color: '#eadbc0',
  border: '1px solid #5a3e8a',
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: '11px',
  cursor: 'pointer',
  marginTop: '6px',
} satisfies Partial<CSSStyleDeclaration>)
panel.appendChild(exportBtn)  // panel = the existing dev-menu container; if it's named differently, append to that root

let exportCb: (() => void) | null = null
exportBtn.addEventListener('click', () => exportCb?.())

return {
  // ...existing returns...
  onExportMidi(cb: () => void) { exportCb = cb },
}
```

(If the existing devMenu file uses different variable names for the container, append the button to whatever the main visible block is. Read the file first.)

**`src/main.ts` — wire callback:**

After `mountDevMenu(...)`:
```ts
import { encodeMidi, downloadMidi } from './audio/midiExport'

devMenu.onExportMidi(() => {
  const cap = music.getCapture()
  if (cap.notes.length === 0) {
    console.warn('[midi] capture buffer empty — play for a few seconds first')
    return
  }
  const bytes = encodeMidi(cap.notes, cap.bpm)
  const filename = `skull-empires-${world.seed}-d${cap.depth}.mid`
  downloadMidi(bytes, filename)
})
```

- [ ] **Step 1:** Read the current `src/ui/devMenu.ts` to find the right append point.
Run: read `src/ui/devMenu.ts` end-to-end before editing.

- [ ] **Step 2:** Apply edits.

- [ ] **Step 3: Typecheck.**
Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 4: Full suite.**
Run: `bun test`
Expected: all green.

- [ ] **Step 5: Manual smoke.**
Run: `bun run dev?dev=1` (or click the dev-menu hotkey to open it). Click "Export MIDI" after ~5s of music. A `.mid` file downloads. Open it in any DAW or `https://onlinesequencer.net` and confirm it plays back recognizably.

- [ ] **Step 6: Commit.**
```bash
git add src/main.ts src/ui/devMenu.ts
git commit -m "feat(dev): export current music capture as MIDI file"
```

---

### T18: Smoke checklist + readme

**Files:**
- Create: `docs/SMOKE-PHASE-1F.md`

**Goal:** Manual smoke checklist for Phase 1F covering all six areas; checked at end of plan.

```markdown
# Phase 1F Smoke Checklist

Run `bun run dev` and walk through:

## Layout
- [ ] Side panel is visible to the right of the canvas; canvas does not overlap it.
- [ ] Canvas resizes when the browser is resized (no blurring of sprites).
- [ ] Click on a canvas tile near the right edge — hero responds; clicks are not eaten by the panel.
- [ ] Dialog (talk to merchant) and item-reward modal still center over the canvas, not the panel.

## Mobile
- [ ] Resize browser to <768px wide. Panel moves to bottom; header strip appears.
- [ ] Tap header → panel collapses to a thin strip with HP bar visible.
- [ ] Tap header again → panel expands.
- [ ] Tap on a tile via touch device or browser touch emulation — hero responds.

## Music
- [ ] On first floor: hear melody (triangle), bass (saw), arp (square), and steady kick + hi-hat percussion.
- [ ] Walk near an enemy (≤3 tiles): tempo bumps and percussion gets louder.
- [ ] Walk away: smoothly returns to baseline.
- [ ] Descend to depth 5 (boss): hear an additional sine pad layer.

## Music UI
- [ ] Side panel shows play/pause toggle + volume slider.
- [ ] Toggle pauses → music goes silent. Toggle plays → music resumes.
- [ ] Slider changes audible volume.
- [ ] Reload page: previous play/pause and volume state are restored.
- [ ] Switch to another tab: music goes silent. Switch back: returns.

## Minimap zoom
- [ ] Small floor: minimap defaults to "full" zoom (whole floor visible).
- [ ] Large floor (>40 tiles wide): minimap defaults to "focused" (window around hero).
- [ ] Click the minimap (or its toggle button): zoom mode flips.
- [ ] In focused mode, hero stays roughly centered as you walk.

## MIDI export
- [ ] With `?dev=1`, open the dev menu.
- [ ] After ~5s of music, click "Export MIDI".
- [ ] A `.mid` file downloads with name `skull-empires-<seed>-d<depth>.mid`.
- [ ] Open the file in a DAW; melody/bass/arp/perc are on separate tracks; tempo matches the floor's BPM.
```

- [ ] **Step 1:** Create the file.

- [ ] **Step 2: Walk through every checkbox manually.**
Mark anything that fails as a follow-up backlog ticket.

- [ ] **Step 3: Commit.**
```bash
git add docs/SMOKE-PHASE-1F.md
git commit -m "docs: phase 1f smoke checklist"
```

---

## Final integration check

Once all tasks are committed:

- [ ] `bun run typecheck` clean.
- [ ] `bun test` green.
- [ ] Manual smoke checklist (T18) passes end-to-end.
- [ ] `git log --oneline feat/phase-1f` reads as a coherent story (one commit per task).

Then merge to `master`:

```bash
cd /home/amr/source/repos/kashik0i/skull-empires-revived
git checkout master
git merge --no-ff feat/phase-1f -m "feat: phase 1f — side panel, mobile, music polish, MIDI export"
git worktree remove .worktrees/phase-1f
git branch -d feat/phase-1f
```
