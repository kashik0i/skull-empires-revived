# Skull Empires Revived — Phase 1A (Playable Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the smallest end-to-end playable browser game: one procgen floor, one hero, one enemy archetype (bone-knight), win-by-kill-all / lose-by-death, deterministic replay from seed + action log. No cards, no dialog, no gestures, no voice, no FX polish, no multiple floors, no boss. The architecture is the same one Phase 1B–1E and Phase 2 extend into.

**Architecture:** Pure-TS core (`state`, `reducer`, seeded RNG, action log) with thin adapters (DOM mouse input, Canvas 2D renderer, DOM HUD). All randomness flows through RNG state. All input produces actions. Every state change goes through `dispatch(action) → reducer → log`. Deterministic replay is tested end-to-end.

**Tech Stack:** TypeScript (strict), Bun (package manager + test runner), Vite (dev server + build), Canvas 2D, DOM for HUD.

**Architecture calls locked during planning** (Design spec §14 open questions):
- Party size for 1A: **1 hero** (single-actor party). Multi-actor party deferred.
- PRNG: **sfc32** (128-bit state, well-tested, small). Implemented in `src/core/rng.ts`.
- Audio: **out of scope for 1A.**
- FX library: **not installed in 1A.** A minimal tween-less renderer is enough; particles/tweens land in 1C/1D.

**Deferred from Phase 1 spec to later sub-phases:**
- **1B** — cards (hand/deck/discard, PlayCard, rewards between floors), multi-floor procgen, stairs.
- **1C** — FX canvas (particles, tweens, screen effects).
- **1D** — gestures (MediaPipe worker + classifier), voice (Web Speech), calibration, onboarding.
- **1E** — dialog system + NPC archetypes + boss floor + content expansion to spec targets (6 enemies / ~20 items / ~15 cards / 4–5 NPCs) + GitHub Pages deploy.

**Ship criterion for 1A (done-when):**
- `bun x vite` serves `http://localhost:5173/?dev=1`.
- Fresh page load → procgen floor visible, hero in a room, enemies scattered.
- Left-click on a walkable tile moves the hero (pathless one-step toward click until blocked).
- Left-click on an adjacent enemy attacks it; enemies take turns back.
- All enemies dead → "You win" overlay with a Share-URL button.
- Hero HP 0 → "You died" overlay with Restart button.
- Share URL loaded on another tab replays to an identical final state.
- `bun test` passes. `bun x tsc --noEmit` passes.

---

## File structure

```
package.json
tsconfig.json
vite.config.ts
bunfig.toml
index.html
.gitignore
.github/workflows/ci.yml
README.md
docs/plans/2026-04-17-skull-empires-revived-design.md   (already exists)
docs/plans/2026-04-17-phase-1a-playable-core.md          (this file)

src/
  main.ts                      # bootstrap + wiring
  loop.ts                      # RAF game loop, time-scale, turn ticks

  core/
    types.ts                   # World, Actor, Action, Tile, etc.
    rng.ts                     # sfc32
    state.ts                   # initial state factory
    log.ts                     # rolling log buffer
    dispatch.ts                # dispatch(action) pipeline
    reducers/
      index.ts                 # root reducer
      move.ts                  # MoveActor
      attack.ts                # AttackActor
      turn.ts                  # TurnAdvance
      run.ts                   # RunEnd, Restart

  procgen/
    bsp.ts                     # BSP dungeon → rooms + corridors
    floor.ts                   # assemble tiles + spawn points

  ai/
    planner.ts                 # Planner interface + rule dispatcher
    behaviors/
      chase.ts                 # chase+attack nearest hero
      patrol.ts                # random walk within room

  content/
    archetypes.json            # hero + bone-knight
    loader.ts                  # JSON → Archetype map

  input/
    dev.ts                     # ?dev=1 mouse + keyboard
    intent.ts                  # Intent → Action

  render/
    world.ts                   # tile + actor drawing (Canvas 2D)

  ui/
    hud.ts                     # HP bar + log list (textContent only)
    overlay.ts                 # win/lose overlay + restart

  persistence/
    storage.ts                 # localStorage wrapper
    url.ts                     # seed + log ↔ share URL
    replay.ts                  # replay action log against reducer

tests/
  core/
    rng.test.ts
    log.test.ts
    reducers/
      move.test.ts
      attack.test.ts
      turn.test.ts
      run.test.ts
  procgen/
    bsp.test.ts
    floor.test.ts
  ai/
    planner.test.ts
  input/
    intent.test.ts
  persistence/
    url.test.ts
    replay.test.ts
  integration/
    full-run.test.ts           # canonical seed+log → final state snapshot
```

Each source file holds one responsibility. Reducers are split by domain. Core is DOM-free and test-runnable in Bun without jsdom.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `bunfig.toml`, `index.html`, `.gitignore`, `src/main.ts`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "skull-empires-revived",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun x vite",
    "build": "bun x vite build",
    "preview": "bun x vite preview",
    "test": "bun test",
    "typecheck": "bun x tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "vite": "5.4.11",
    "@types/bun": "1.1.14"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5173 },
  build: { target: 'es2022' },
})
```

- [ ] **Step 4: Create bunfig.toml**

```toml
[test]
preload = []
```

- [ ] **Step 5: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Skull Empires Revived</title>
    <style>
      html, body { margin: 0; height: 100%; background: #120a1c; color: #e8d9f7; font-family: ui-serif, Georgia, serif; }
      #stage { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
      #world { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
      #hud { position: absolute; inset: 0; pointer-events: none; }
      #hud > * { pointer-events: auto; }
    </style>
  </head>
  <body>
    <div id="stage">
      <canvas id="world" width="960" height="640"></canvas>
      <div id="hud"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create src/main.ts stub**

```ts
export const bootMarker = 'skull-empires-revived:boot'
console.log(bootMarker)
```

- [ ] **Step 7: Create .gitignore**

```
node_modules
dist
.vite
*.log
.DS_Store
bun.lockb
```

- [ ] **Step 8: Install and verify**

Run: `bun install`
Run: `bun x tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vite.config.ts bunfig.toml index.html src/main.ts .gitignore
git commit -m "chore: scaffold bun + vite + typescript"
```

---

## Task 2: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: CI
on:
  push:
    branches: [master, main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun x tsc --noEmit
      - run: bun test
      - run: bun x vite build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck, test, build workflow"
```

---

## Task 3: Seeded PRNG (sfc32)

**Files:**
- Create: `src/core/rng.ts`
- Test: `tests/core/rng.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/core/rng.test.ts`:

```ts
import { describe, it, expect } from 'bun:test'
import { createRng, nextU32, nextFloat, nextInt, type RngState } from '../../src/core/rng'

describe('rng (sfc32)', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('seed-one')
    const b = createRng('seed-one')
    const seqA: number[] = []
    const seqB: number[] = []
    let sa: RngState = a, sb: RngState = b
    for (let i = 0; i < 20; i++) {
      const ra = nextU32(sa); seqA.push(ra.value); sa = ra.state
      const rb = nextU32(sb); seqB.push(rb.value); sb = rb.state
    }
    expect(seqA).toEqual(seqB)
  })

  it('diverges on different seeds', () => {
    const a = createRng('seed-one')
    const b = createRng('seed-two')
    const ra = nextU32(a)
    const rb = nextU32(b)
    expect(ra.value).not.toBe(rb.value)
  })

  it('nextInt returns values in [min, max)', () => {
    let s = createRng('range')
    for (let i = 0; i < 1000; i++) {
      const r = nextInt(s, 3, 9)
      expect(r.value).toBeGreaterThanOrEqual(3)
      expect(r.value).toBeLessThan(9)
      s = r.state
    }
  })

  it('nextFloat returns values in [0, 1)', () => {
    let s = createRng('float')
    for (let i = 0; i < 1000; i++) {
      const r = nextFloat(s)
      expect(r.value).toBeGreaterThanOrEqual(0)
      expect(r.value).toBeLessThan(1)
      s = r.state
    }
  })
})
```

- [ ] **Step 2: Run the test, see it fail**

Run: `bun test tests/core/rng.test.ts`
Expected: FAIL ("Cannot find module '../../src/core/rng'").

- [ ] **Step 3: Implement src/core/rng.ts**

```ts
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
```

- [ ] **Step 4: Run the test, see it pass**

Run: `bun test tests/core/rng.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.ts tests/core/rng.test.ts
git commit -m "feat(core): seeded sfc32 prng"
```

---

## Task 4: Core types

**Files:**
- Create: `src/core/types.ts`

No test for this task — it is pure type declarations. Downstream tasks exercise them.

- [ ] **Step 1: Write src/core/types.ts**

```ts
import type { RngState } from './rng'

export type ActorId = string

export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
} as const
export type TileKind = (typeof Tile)[keyof typeof Tile]

export type Pos = { x: number; y: number }

export type Actor = {
  id: ActorId
  kind: 'hero' | 'enemy'
  archetype: string
  pos: Pos
  hp: number
  maxHp: number
  atk: number
  def: number
  alive: boolean
}

export type Floor = {
  width: number
  height: number
  tiles: Uint8Array
  spawns: Pos[]
}

export type Phase = 'exploring' | 'run_won' | 'run_lost'

export type LogEntry = { tick: number; text: string }

export type World = {
  seed: string
  tick: number
  phase: Phase
  floor: Floor
  actors: Record<ActorId, Actor>
  heroId: ActorId
  turnOrder: ActorId[]
  turnIndex: number
  log: LogEntry[]
  rng: RngState
}

export type Action =
  | { type: 'MoveActor'; actorId: ActorId; to: Pos }
  | { type: 'AttackActor'; attackerId: ActorId; targetId: ActorId }
  | { type: 'TurnAdvance' }
  | { type: 'RunEnd'; outcome: 'won' | 'lost' }
  | { type: 'Restart'; seed: string }
```

- [ ] **Step 2: Verify it typechecks**

Run: `bun x tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): world, actor, action type definitions"
```

---

## Task 5: Rolling log buffer

**Files:**
- Create: `src/core/log.ts`
- Test: `tests/core/log.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { appendLog, LOG_MAX } from '../../src/core/log'
import type { LogEntry } from '../../src/core/types'

describe('log', () => {
  it('appends entries', () => {
    const a: LogEntry[] = []
    const b = appendLog(a, { tick: 1, text: 'hello' })
    expect(b).toEqual([{ tick: 1, text: 'hello' }])
    expect(a).toEqual([])
  })

  it('caps at LOG_MAX', () => {
    let entries: LogEntry[] = []
    for (let i = 0; i < LOG_MAX + 10; i++) {
      entries = appendLog(entries, { tick: i, text: `e${i}` })
    }
    expect(entries.length).toBe(LOG_MAX)
    expect(entries[0].tick).toBe(10)
    expect(entries[entries.length - 1].tick).toBe(LOG_MAX + 9)
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/core/log.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement src/core/log.ts**

```ts
import type { LogEntry } from './types'

export const LOG_MAX = 50

export function appendLog(log: readonly LogEntry[], entry: LogEntry): LogEntry[] {
  const next = log.length >= LOG_MAX ? log.slice(log.length - LOG_MAX + 1) : log.slice()
  next.push(entry)
  return next
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/core/log.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/log.ts tests/core/log.test.ts
git commit -m "feat(core): rolling log buffer"
```

---

## Task 6: BSP dungeon generator

**Files:**
- Create: `src/procgen/bsp.ts`
- Test: `tests/procgen/bsp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createRng } from '../../src/core/rng'
import { generateBsp } from '../../src/procgen/bsp'

describe('bsp generator', () => {
  it('produces >= 3 rooms for a 40x30 floor', () => {
    const { rooms } = generateBsp(createRng('bsp-1'), 40, 30)
    expect(rooms.length).toBeGreaterThanOrEqual(3)
    for (const r of rooms) {
      expect(r.w).toBeGreaterThanOrEqual(3)
      expect(r.h).toBeGreaterThanOrEqual(3)
      expect(r.x + r.w).toBeLessThanOrEqual(40)
      expect(r.y + r.h).toBeLessThanOrEqual(30)
    }
  })

  it('produces corridors connecting every pair of rooms transitively', () => {
    const { rooms, corridors } = generateBsp(createRng('bsp-2'), 40, 30)
    const nodes = rooms.map((_, i) => i)
    const parent = nodes.slice()
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    const union = (a: number, b: number) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb }
    for (const c of corridors) union(c.fromRoom, c.toRoom)
    const roots = new Set(nodes.map(find))
    expect(roots.size).toBe(1)
  })

  it('is deterministic for the same seed', () => {
    const a = generateBsp(createRng('seed-x'), 40, 30)
    const b = generateBsp(createRng('seed-x'), 40, 30)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/procgen/bsp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/procgen/bsp.ts**

```ts
import { nextInt, type RngState } from '../core/rng'

export type Room = { x: number; y: number; w: number; h: number }
export type Corridor = { fromRoom: number; toRoom: number; points: { x: number; y: number }[] }

export type BspResult = { rooms: Room[]; corridors: Corridor[] }

type Leaf = { x: number; y: number; w: number; h: number; roomIndex?: number }

const MIN_SIZE = 8

export function generateBsp(rng: RngState, width: number, height: number): BspResult {
  let s = rng
  const leaves: Leaf[] = [{ x: 0, y: 0, w: width, h: height }]
  let i = 0
  while (i < leaves.length) {
    const l = leaves[i]
    const canSplitH = l.w > MIN_SIZE * 2
    const canSplitV = l.h > MIN_SIZE * 2
    if (!canSplitH && !canSplitV) { i++; continue }
    let splitH = canSplitH
    if (canSplitH && canSplitV) {
      const r = nextInt(s, 0, 2)
      s = r.state
      splitH = r.value === 0
    }
    if (splitH) {
      const r = nextInt(s, MIN_SIZE, l.w - MIN_SIZE); s = r.state
      leaves.push({ x: l.x, y: l.y, w: r.value, h: l.h })
      leaves.push({ x: l.x + r.value, y: l.y, w: l.w - r.value, h: l.h })
    } else {
      const r = nextInt(s, MIN_SIZE, l.h - MIN_SIZE); s = r.state
      leaves.push({ x: l.x, y: l.y, w: l.w, h: r.value })
      leaves.push({ x: l.x, y: l.y + r.value, w: l.w, h: l.h - r.value })
    }
    leaves.splice(i, 1)
  }
  const rooms: Room[] = []
  for (const l of leaves) {
    const w = Math.max(3, l.w - 3)
    const h = Math.max(3, l.h - 3)
    const rw = nextInt(s, 3, w + 1); s = rw.state
    const rh = nextInt(s, 3, h + 1); s = rh.state
    const rx = nextInt(s, l.x + 1, l.x + l.w - rw.value); s = rx.state
    const ry = nextInt(s, l.y + 1, l.y + l.h - rh.value); s = ry.state
    l.roomIndex = rooms.length
    rooms.push({ x: rx.value, y: ry.value, w: rw.value, h: rh.value })
  }
  const corridors: Corridor[] = []
  for (let j = 1; j < rooms.length; j++) {
    const a = rooms[j - 1]; const b = rooms[j]
    const ax = a.x + (a.w >> 1); const ay = a.y + (a.h >> 1)
    const bx = b.x + (b.w >> 1); const by = b.y + (b.h >> 1)
    const points: { x: number; y: number }[] = []
    const stepX = ax < bx ? 1 : -1
    for (let x = ax; x !== bx; x += stepX) points.push({ x, y: ay })
    const stepY = ay < by ? 1 : -1
    for (let y = ay; y !== by; y += stepY) points.push({ x: bx, y })
    points.push({ x: bx, y: by })
    corridors.push({ fromRoom: j - 1, toRoom: j, points })
  }
  return { rooms, corridors }
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/procgen/bsp.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bsp.ts tests/procgen/bsp.test.ts
git commit -m "feat(procgen): bsp room + corridor generator"
```

---

## Task 7: Floor assembly

**Files:**
- Create: `src/procgen/floor.ts`
- Test: `tests/procgen/floor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createRng } from '../../src/core/rng'
import { Tile } from '../../src/core/types'
import { generateFloor } from '../../src/procgen/floor'

describe('floor', () => {
  it('carves floor tiles where rooms and corridors are', () => {
    const { floor } = generateFloor(createRng('floor-1'), 40, 30)
    expect(floor.width).toBe(40)
    expect(floor.height).toBe(30)
    let floorCount = 0
    for (let i = 0; i < floor.tiles.length; i++) if (floor.tiles[i] === Tile.Floor) floorCount++
    expect(floorCount).toBeGreaterThan(20)
  })

  it('walls surround floor tiles', () => {
    const { floor } = generateFloor(createRng('floor-2'), 40, 30)
    for (let y = 1; y < floor.height - 1; y++) {
      for (let x = 1; x < floor.width - 1; x++) {
        if (floor.tiles[y * floor.width + x] === Tile.Floor) {
          const neighbours = [
            floor.tiles[(y - 1) * floor.width + x],
            floor.tiles[(y + 1) * floor.width + x],
            floor.tiles[y * floor.width + (x - 1)],
            floor.tiles[y * floor.width + (x + 1)],
          ]
          for (const n of neighbours) {
            expect([Tile.Floor, Tile.Wall]).toContain(n)
          }
        }
      }
    }
  })

  it('produces at least two spawn points on floor tiles', () => {
    const { floor } = generateFloor(createRng('floor-3'), 40, 30)
    expect(floor.spawns.length).toBeGreaterThanOrEqual(2)
    for (const s of floor.spawns) {
      expect(floor.tiles[s.y * floor.width + s.x]).toBe(Tile.Floor)
    }
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/procgen/floor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/procgen/floor.ts**

```ts
import type { RngState } from '../core/rng'
import { Tile, type Floor } from '../core/types'
import { generateBsp } from './bsp'

export type FloorResult = { floor: Floor; rng: RngState }

export function generateFloor(rng: RngState, width: number, height: number): FloorResult {
  const tiles = new Uint8Array(width * height)
  tiles.fill(Tile.Wall)
  const bsp = generateBsp(rng, width, height)
  for (const room of bsp.rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        tiles[y * width + x] = Tile.Floor
      }
    }
  }
  for (const corridor of bsp.corridors) {
    for (const p of corridor.points) {
      if (p.x >= 0 && p.y >= 0 && p.x < width && p.y < height) {
        tiles[p.y * width + p.x] = Tile.Floor
      }
    }
  }
  const spawns = bsp.rooms.map(r => ({
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  }))
  return {
    floor: { width, height, tiles, spawns },
    rng,
  }
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/procgen/floor.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/procgen/floor.ts tests/procgen/floor.test.ts
git commit -m "feat(procgen): floor assembly from bsp"
```

---

## Task 8: Content archetypes

**Files:**
- Create: `src/content/archetypes.json`, `src/content/loader.ts`

- [ ] **Step 1: Write src/content/archetypes.json**

```json
{
  "hero": {
    "kind": "hero",
    "name": "Wanderer",
    "hp": 20,
    "atk": 4,
    "def": 1,
    "color": "#f5e6b0"
  },
  "bone-knight": {
    "kind": "enemy",
    "name": "Bone Knight",
    "hp": 8,
    "atk": 3,
    "def": 0,
    "color": "#b7a3d9",
    "behavior": "chase"
  }
}
```

- [ ] **Step 2: Write src/content/loader.ts**

```ts
import raw from './archetypes.json'

export type ArchetypeDef = {
  kind: 'hero' | 'enemy'
  name: string
  hp: number
  atk: number
  def: number
  color: string
  behavior?: string
}

const typed: Record<string, ArchetypeDef> = raw as Record<string, ArchetypeDef>

export function getArchetype(key: string): ArchetypeDef {
  const a = typed[key]
  if (!a) throw new Error(`unknown archetype: ${key}`)
  return a
}

export function listArchetypes(): Record<string, ArchetypeDef> {
  return typed
}
```

- [ ] **Step 3: Verify typecheck**

Run: `bun x tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/content/archetypes.json src/content/loader.ts
git commit -m "feat(content): archetype loader (hero + bone-knight)"
```

---

## Task 9: Initial state factory

**Files:**
- Create: `src/core/state.ts`
- Test: `tests/core/reducers/state.test.ts` (we'll put state tests alongside reducers)

*(Test file path chosen so it sits next to reducer tests; placing it at `tests/core/state.test.ts` is also acceptable.)*

- [ ] **Step 1: Write the failing test**

`tests/core/reducers/state.test.ts`:

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { Tile } from '../../../src/core/types'

describe('initial state', () => {
  it('places hero on a floor tile', () => {
    const w = createInitialWorld('seed-1')
    const hero = w.actors[w.heroId]
    expect(hero).toBeDefined()
    expect(hero.kind).toBe('hero')
    expect(w.floor.tiles[hero.pos.y * w.floor.width + hero.pos.x]).toBe(Tile.Floor)
  })

  it('spawns 2+ bone-knight enemies on floor tiles', () => {
    const w = createInitialWorld('seed-1')
    const enemies = Object.values(w.actors).filter(a => a.kind === 'enemy')
    expect(enemies.length).toBeGreaterThanOrEqual(2)
    for (const e of enemies) {
      expect(w.floor.tiles[e.pos.y * w.floor.width + e.pos.x]).toBe(Tile.Floor)
      expect(e.archetype).toBe('bone-knight')
    }
  })

  it('is deterministic for the same seed', () => {
    const a = createInitialWorld('seed-deterministic')
    const b = createInitialWorld('seed-deterministic')
    expect(a.actors).toEqual(b.actors)
    expect(Array.from(a.floor.tiles)).toEqual(Array.from(b.floor.tiles))
  })

  it('starts in exploring phase with empty log', () => {
    const w = createInitialWorld('seed-1')
    expect(w.phase).toBe('exploring')
    expect(w.log).toEqual([])
    expect(w.tick).toBe(0)
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/core/reducers/state.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement src/core/state.ts**

```ts
import { createRng, nextU32 } from './rng'
import type { Actor, ActorId, World } from './types'
import { generateFloor } from '../procgen/floor'
import { getArchetype } from '../content/loader'

const FLOOR_W = 40
const FLOOR_H = 30

export function createInitialWorld(seed: string): World {
  let rng = createRng(seed)
  const { floor } = generateFloor(rng, FLOOR_W, FLOOR_H)
  // advance rng past floor generation deterministically
  const after = nextU32(rng); rng = after.state

  const actors: Record<ActorId, Actor> = {}
  const spawns = floor.spawns

  const heroSpawn = spawns[0]
  const heroDef = getArchetype('hero')
  const hero: Actor = {
    id: 'hero-1',
    kind: 'hero',
    archetype: 'hero',
    pos: heroSpawn,
    hp: heroDef.hp,
    maxHp: heroDef.hp,
    atk: heroDef.atk,
    def: heroDef.def,
    alive: true,
  }
  actors[hero.id] = hero

  const enemyCount = Math.min(spawns.length - 1, 4)
  for (let i = 0; i < enemyCount; i++) {
    const spawn = spawns[i + 1]
    const def = getArchetype('bone-knight')
    const id = `enemy-${i + 1}`
    actors[id] = {
      id,
      kind: 'enemy',
      archetype: 'bone-knight',
      pos: spawn,
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      def: def.def,
      alive: true,
    }
  }

  const turnOrder = Object.keys(actors)
  return {
    seed,
    tick: 0,
    phase: 'exploring',
    floor,
    actors,
    heroId: hero.id,
    turnOrder,
    turnIndex: 0,
    log: [],
    rng,
  }
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/core/reducers/state.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/state.ts tests/core/reducers/state.test.ts
git commit -m "feat(core): initial world state factory"
```

---

## Task 10: Move reducer

**Files:**
- Create: `src/core/reducers/move.ts`, `src/core/reducers/index.ts`, `src/core/dispatch.ts`
- Test: `tests/core/reducers/move.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'

describe('MoveActor reducer', () => {
  it('moves the hero to an adjacent walkable tile', () => {
    const w = createInitialWorld('move-1')
    const hero = w.actors[w.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: target })
    expect(w2.actors[w.heroId].pos).toEqual(target)
  })

  it('refuses to move onto a wall', () => {
    const w = createInitialWorld('move-2')
    const hero = w.actors[w.heroId]
    const blocked = { x: -1, y: hero.pos.y }
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: blocked })
    expect(w2).toBe(w)
  })

  it('refuses to move onto a tile occupied by another actor', () => {
    const w = createInitialWorld('move-3')
    const hero = w.actors[w.heroId]
    const enemy = Object.values(w.actors).find(a => a.kind === 'enemy')!
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: enemy.pos })
    expect(w2).toBe(w)
  })

  it('refuses to move more than one tile away (orthogonal)', () => {
    const w = createInitialWorld('move-4')
    const hero = w.actors[w.heroId]
    const far = { x: hero.pos.x + 3, y: hero.pos.y }
    const w2 = rootReducer(w, { type: 'MoveActor', actorId: w.heroId, to: far })
    expect(w2).toBe(w)
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/core/reducers/move.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write src/core/reducers/move.ts**

```ts
import { Tile, type World, type Action, type ActorId, type Pos } from '../types'

export function moveActor(state: World, action: Extract<Action, { type: 'MoveActor' }>): World {
  const actor = state.actors[action.actorId]
  if (!actor || !actor.alive) return state
  if (!isAdjacent(actor.pos, action.to)) return state
  if (!isWalkable(state, action.to)) return state
  if (isOccupied(state, action.to, action.actorId)) return state
  return {
    ...state,
    actors: {
      ...state.actors,
      [action.actorId]: { ...actor, pos: action.to },
    },
  }
}

function isAdjacent(a: Pos, b: Pos): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return dx + dy === 1
}

function isWalkable(state: World, p: Pos): boolean {
  const { floor } = state
  if (p.x < 0 || p.y < 0 || p.x >= floor.width || p.y >= floor.height) return false
  return floor.tiles[p.y * floor.width + p.x] === Tile.Floor
}

function isOccupied(state: World, p: Pos, ignore: ActorId): boolean {
  for (const id in state.actors) {
    if (id === ignore) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === p.x && a.pos.y === p.y) return true
  }
  return false
}
```

- [ ] **Step 4: Write src/core/reducers/index.ts**

```ts
import type { Action, World } from '../types'
import { moveActor } from './move'

export function rootReducer(state: World, action: Action): World {
  switch (action.type) {
    case 'MoveActor': return moveActor(state, action)
    default: return state
  }
}
```

- [ ] **Step 5: Write src/core/dispatch.ts**

```ts
import type { Action, World } from './types'
import { rootReducer } from './reducers'
import { appendLog } from './log'

export function dispatch(state: World, action: Action): World {
  const next = rootReducer(state, action)
  if (next === state) return state
  const text = describeAction(action, next)
  const withLog = { ...next, log: appendLog(next.log, { tick: next.tick, text }) }
  return withLog
}

function describeAction(action: Action, state: World): string {
  switch (action.type) {
    case 'MoveActor': {
      const actor = state.actors[action.actorId]
      return `${actor?.archetype ?? action.actorId} moves to (${action.to.x},${action.to.y})`
    }
    case 'AttackActor': {
      const a = state.actors[action.attackerId]
      const t = state.actors[action.targetId]
      return `${a?.archetype ?? action.attackerId} attacks ${t?.archetype ?? action.targetId}`
    }
    case 'TurnAdvance': return `turn advance (tick ${state.tick})`
    case 'RunEnd': return `run ended: ${action.outcome}`
    case 'Restart': return `restart with seed ${action.seed}`
  }
}
```

- [ ] **Step 6: Run, see it pass**

Run: `bun test tests/core/reducers/move.test.ts`
Expected: 4 pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/reducers src/core/dispatch.ts tests/core/reducers/move.test.ts
git commit -m "feat(core): move reducer + dispatch pipeline"
```

---

## Task 11: Attack reducer

**Files:**
- Create: `src/core/reducers/attack.ts`
- Modify: `src/core/reducers/index.ts`
- Test: `tests/core/reducers/attack.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'
import type { World, Action } from '../../../src/core/types'

function placeEnemyNextToHero(w: World): { world: World; enemyId: string } {
  const hero = w.actors[w.heroId]
  const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
  const enemy = w.actors[enemyId]
  return {
    world: {
      ...w,
      actors: {
        ...w.actors,
        [enemyId]: { ...enemy, pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    },
    enemyId,
  }
}

describe('AttackActor reducer', () => {
  it('reduces target hp by max(1, atk - def)', () => {
    const base = createInitialWorld('attack-1')
    const { world: w, enemyId } = placeEnemyNextToHero(base)
    const beforeHp = w.actors[enemyId].hp
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }
    const w2 = rootReducer(w, action)
    const dmg = Math.max(1, w.actors[w.heroId].atk - w.actors[enemyId].def)
    expect(w2.actors[enemyId].hp).toBe(beforeHp - dmg)
  })

  it('marks target as dead at hp <= 0', () => {
    const base = createInitialWorld('attack-2')
    const { world, enemyId } = placeEnemyNextToHero(base)
    const w = { ...world, actors: { ...world.actors, [enemyId]: { ...world.actors[enemyId], hp: 1 } } }
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }
    const w2 = rootReducer(w, action)
    expect(w2.actors[enemyId].hp).toBeLessThanOrEqual(0)
    expect(w2.actors[enemyId].alive).toBe(false)
  })

  it('refuses if target is not adjacent', () => {
    const w = createInitialWorld('attack-3')
    const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
    const action: Action = { type: 'AttackActor', attackerId: w.heroId, targetId: enemyId }
    const w2 = rootReducer(w, action)
    expect(w2).toBe(w)
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/core/reducers/attack.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write src/core/reducers/attack.ts**

```ts
import type { World, Action, Pos } from '../types'

export function attackActor(state: World, action: Extract<Action, { type: 'AttackActor' }>): World {
  const attacker = state.actors[action.attackerId]
  const target = state.actors[action.targetId]
  if (!attacker || !target || !attacker.alive || !target.alive) return state
  if (!adjacent(attacker.pos, target.pos)) return state
  const dmg = Math.max(1, attacker.atk - target.def)
  const hp = target.hp - dmg
  const alive = hp > 0
  return {
    ...state,
    actors: {
      ...state.actors,
      [target.id]: { ...target, hp, alive },
    },
  }
}

function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}
```

- [ ] **Step 4: Wire attackActor into src/core/reducers/index.ts**

Replace the file body with:

```ts
import type { Action, World } from '../types'
import { moveActor } from './move'
import { attackActor } from './attack'

export function rootReducer(state: World, action: Action): World {
  switch (action.type) {
    case 'MoveActor': return moveActor(state, action)
    case 'AttackActor': return attackActor(state, action)
    default: return state
  }
}
```

- [ ] **Step 5: Run, see it pass**

Run: `bun test tests/core/reducers/attack.test.ts`
Expected: 3 pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/reducers/attack.ts src/core/reducers/index.ts tests/core/reducers/attack.test.ts
git commit -m "feat(core): attack reducer with damage + death"
```

---

## Task 12: Turn advance reducer

**Files:**
- Create: `src/core/reducers/turn.ts`
- Modify: `src/core/reducers/index.ts`
- Test: `tests/core/reducers/turn.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'

describe('TurnAdvance reducer', () => {
  it('advances turnIndex, wraps, and bumps tick', () => {
    const w = createInitialWorld('turn-1')
    const len = w.turnOrder.length
    const w2 = rootReducer(w, { type: 'TurnAdvance' })
    expect(w2.turnIndex).toBe(1 % len)
    expect(w2.tick).toBe(w.tick + 1)
  })

  it('skips dead actors', () => {
    const base = createInitialWorld('turn-2')
    const deadId = base.turnOrder[1]
    const w = { ...base, actors: { ...base.actors, [deadId]: { ...base.actors[deadId], alive: false, hp: 0 } } }
    const w2 = rootReducer(w, { type: 'TurnAdvance' })
    expect(w2.turnIndex).toBe(2 % w.turnOrder.length)
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/core/reducers/turn.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write src/core/reducers/turn.ts**

```ts
import type { World } from '../types'

export function turnAdvance(state: World): World {
  const len = state.turnOrder.length
  if (len === 0) return state
  let idx = state.turnIndex
  for (let i = 0; i < len; i++) {
    idx = (idx + 1) % len
    const actor = state.actors[state.turnOrder[idx]]
    if (actor && actor.alive) break
  }
  return { ...state, turnIndex: idx, tick: state.tick + 1 }
}
```

- [ ] **Step 4: Wire into src/core/reducers/index.ts**

```ts
import type { Action, World } from '../types'
import { moveActor } from './move'
import { attackActor } from './attack'
import { turnAdvance } from './turn'

export function rootReducer(state: World, action: Action): World {
  switch (action.type) {
    case 'MoveActor': return moveActor(state, action)
    case 'AttackActor': return attackActor(state, action)
    case 'TurnAdvance': return turnAdvance(state)
    default: return state
  }
}
```

- [ ] **Step 5: Run, see it pass**

Run: `bun test tests/core/reducers/turn.test.ts`
Expected: 2 pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/reducers/turn.ts src/core/reducers/index.ts tests/core/reducers/turn.test.ts
git commit -m "feat(core): turn advance reducer"
```

---

## Task 13: Run-end + restart reducer

**Files:**
- Create: `src/core/reducers/run.ts`
- Modify: `src/core/reducers/index.ts`
- Test: `tests/core/reducers/run.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/core/reducers/run.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write src/core/reducers/run.ts**

```ts
import type { World, Action } from '../types'
import { createInitialWorld } from '../state'

export function runEnd(state: World, action: Extract<Action, { type: 'RunEnd' }>): World {
  return { ...state, phase: action.outcome === 'won' ? 'run_won' : 'run_lost' }
}

export function restart(_state: World, action: Extract<Action, { type: 'Restart' }>): World {
  return createInitialWorld(action.seed)
}
```

- [ ] **Step 4: Wire into src/core/reducers/index.ts**

```ts
import type { Action, World } from '../types'
import { moveActor } from './move'
import { attackActor } from './attack'
import { turnAdvance } from './turn'
import { runEnd, restart } from './run'

export function rootReducer(state: World, action: Action): World {
  switch (action.type) {
    case 'MoveActor': return moveActor(state, action)
    case 'AttackActor': return attackActor(state, action)
    case 'TurnAdvance': return turnAdvance(state)
    case 'RunEnd': return runEnd(state, action)
    case 'Restart': return restart(state, action)
    default: return state
  }
}
```

- [ ] **Step 5: Run, see it pass**

Run: `bun test tests/core/reducers/run.test.ts`
Expected: 3 pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/reducers/run.ts src/core/reducers/index.ts tests/core/reducers/run.test.ts
git commit -m "feat(core): run-end + restart reducers"
```

---

## Task 14: AI planner (chase behavior)

**Files:**
- Create: `src/ai/planner.ts`, `src/ai/behaviors/chase.ts`
- Test: `tests/ai/planner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { decide } from '../../src/ai/planner'

describe('planner (chase behavior for bone-knight)', () => {
  it('attacks when adjacent to the hero', () => {
    const base = createInitialWorld('plan-1')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    }
    const action = decide(w, enemyId)
    expect(action.type).toBe('AttackActor')
  })

  it('moves one step toward hero when not adjacent', () => {
    const w = createInitialWorld('plan-2')
    const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
    const enemy = w.actors[enemyId]
    const action = decide(w, enemyId)
    if (action.type === 'MoveActor') {
      const d = Math.abs(action.to.x - enemy.pos.x) + Math.abs(action.to.y - enemy.pos.y)
      expect(d).toBe(1)
    } else {
      expect(action.type).toBe('TurnAdvance')
    }
  })

  it('returns TurnAdvance when the actor has no viable action', () => {
    const base = createInitialWorld('plan-3')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const dead = { ...base.actors[enemyId], alive: false, hp: 0 }
    const w = { ...base, actors: { ...base.actors, [enemyId]: dead } }
    const action = decide(w, enemyId)
    expect(action.type).toBe('TurnAdvance')
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/ai/planner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write src/ai/behaviors/chase.ts**

```ts
import { Tile, type World, type Action, type ActorId, type Pos } from '../../core/types'

export function chaseHero(state: World, actorId: ActorId): Action {
  const actor = state.actors[actorId]
  const hero = state.actors[state.heroId]
  if (!actor || !actor.alive || !hero || !hero.alive) return { type: 'TurnAdvance' }
  if (manhattan(actor.pos, hero.pos) === 1) {
    return { type: 'AttackActor', attackerId: actorId, targetId: state.heroId }
  }
  const step = greedyStep(state, actor.pos, hero.pos, actorId)
  if (step) return { type: 'MoveActor', actorId, to: step }
  return { type: 'TurnAdvance' }
}

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function greedyStep(state: World, from: Pos, to: Pos, self: ActorId): Pos | null {
  const candidates: Pos[] = []
  if (to.x !== from.x) candidates.push({ x: from.x + Math.sign(to.x - from.x), y: from.y })
  if (to.y !== from.y) candidates.push({ x: from.x, y: from.y + Math.sign(to.y - from.y) })
  for (const p of candidates) {
    if (!inBounds(state, p)) continue
    if (state.floor.tiles[p.y * state.floor.width + p.x] !== Tile.Floor) continue
    if (isOccupied(state, p, self)) continue
    return p
  }
  return null
}

function inBounds(state: World, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < state.floor.width && p.y < state.floor.height
}

function isOccupied(state: World, p: Pos, ignore: ActorId): boolean {
  for (const id in state.actors) {
    if (id === ignore) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === p.x && a.pos.y === p.y) return true
  }
  return false
}
```

- [ ] **Step 4: Write src/ai/planner.ts**

```ts
import type { World, Action, ActorId } from '../core/types'
import { getArchetype } from '../content/loader'
import { chaseHero } from './behaviors/chase'

export function decide(state: World, actorId: ActorId): Action {
  const actor = state.actors[actorId]
  if (!actor || !actor.alive) return { type: 'TurnAdvance' }
  if (actor.kind === 'hero') return { type: 'TurnAdvance' }  // hero is player-driven
  const def = getArchetype(actor.archetype)
  switch (def.behavior ?? 'chase') {
    case 'chase': return chaseHero(state, actorId)
    default: return { type: 'TurnAdvance' }
  }
}
```

- [ ] **Step 5: Run, see it pass**

Run: `bun test tests/ai/planner.test.ts`
Expected: 3 pass.

- [ ] **Step 6: Commit**

```bash
git add src/ai src/core tests/ai
git commit -m "feat(ai): rule-based planner with chase behavior"
```

---

## Task 15: Intent → Action mapper

**Files:**
- Create: `src/input/intent.ts`
- Test: `tests/input/intent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { intentForClick } from '../../src/input/intent'

describe('intentForClick', () => {
  it('returns MoveActor toward an empty adjacent tile', () => {
    const w = createInitialWorld('i-1')
    const hero = w.actors[w.heroId]
    const action = intentForClick(w, { x: hero.pos.x + 1, y: hero.pos.y })
    expect(action?.type).toBe('MoveActor')
  })

  it('returns AttackActor when clicking an adjacent enemy', () => {
    const base = createInitialWorld('i-2')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const hero = base.actors[base.heroId]
    const w = {
      ...base,
      actors: {
        ...base.actors,
        [enemyId]: { ...base.actors[enemyId], pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    }
    const enemy = w.actors[enemyId]
    const action = intentForClick(w, enemy.pos)
    expect(action).toEqual({ type: 'AttackActor', attackerId: w.heroId, targetId: enemyId })
  })

  it('returns null for a click on a non-adjacent tile', () => {
    const w = createInitialWorld('i-3')
    const hero = w.actors[w.heroId]
    const action = intentForClick(w, { x: hero.pos.x + 4, y: hero.pos.y })
    expect(action).toBeNull()
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/input/intent.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/input/intent.ts**

```ts
import type { Action, Pos, World } from '../core/types'

export function intentForClick(state: World, tile: Pos): Action | null {
  const hero = state.actors[state.heroId]
  if (!hero || !hero.alive) return null
  const dx = tile.x - hero.pos.x
  const dy = tile.y - hero.pos.y
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null
  for (const id in state.actors) {
    if (id === state.heroId) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === tile.x && a.pos.y === tile.y) {
      return { type: 'AttackActor', attackerId: state.heroId, targetId: id }
    }
  }
  return { type: 'MoveActor', actorId: state.heroId, to: tile }
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/input/intent.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/input/intent.ts tests/input/intent.test.ts
git commit -m "feat(input): click-to-intent mapper"
```

---

## Task 16: Win/lose detection helper

**Files:**
- Create: `src/core/selectors.ts`
- Test: `tests/core/reducers/selectors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { runOutcome } from '../../../src/core/selectors'

describe('runOutcome', () => {
  it('returns null while enemies and hero are alive', () => {
    const w = createInitialWorld('out-1')
    expect(runOutcome(w)).toBeNull()
  })

  it("returns 'lost' when hero is dead", () => {
    const base = createInitialWorld('out-2')
    const w = { ...base, actors: { ...base.actors, [base.heroId]: { ...base.actors[base.heroId], alive: false, hp: 0 } } }
    expect(runOutcome(w)).toBe('lost')
  })

  it("returns 'won' when all enemies are dead", () => {
    const base = createInitialWorld('out-3')
    const actors = { ...base.actors }
    for (const id of Object.keys(actors)) {
      if (actors[id].kind === 'enemy') actors[id] = { ...actors[id], alive: false, hp: 0 }
    }
    const w = { ...base, actors }
    expect(runOutcome(w)).toBe('won')
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/core/reducers/selectors.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/core/selectors.ts**

```ts
import type { World } from './types'

export function runOutcome(state: World): 'won' | 'lost' | null {
  const hero = state.actors[state.heroId]
  if (!hero || !hero.alive) return 'lost'
  let anyEnemyAlive = false
  for (const id in state.actors) {
    const a = state.actors[id]
    if (a.kind === 'enemy' && a.alive) { anyEnemyAlive = true; break }
  }
  if (!anyEnemyAlive) return 'won'
  return null
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/core/reducers/selectors.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/selectors.ts tests/core/reducers/selectors.test.ts
git commit -m "feat(core): run outcome selector"
```

---

## Task 17: URL share (seed + log)

**Files:**
- Create: `src/persistence/url.ts`
- Test: `tests/persistence/url.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
    expect(decoded.seed).toBe(seed)
    expect(decoded.log).toEqual(log)
  })

  it('returns null on malformed input', () => {
    expect(decodeRun('not-a-real-encoding')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/persistence/url.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/persistence/url.ts**

```ts
import type { Action } from '../core/types'

export type EncodedRun = string

export function encodeRun(seed: string, log: readonly Action[]): EncodedRun {
  const payload = JSON.stringify({ seed, log })
  return btoa(unescape(encodeURIComponent(payload)))
}

export function decodeRun(encoded: EncodedRun): { seed: string; log: Action[] } | null {
  try {
    const payload = decodeURIComponent(escape(atob(encoded)))
    const parsed = JSON.parse(payload) as { seed?: unknown; log?: unknown }
    if (typeof parsed.seed !== 'string' || !Array.isArray(parsed.log)) return null
    return { seed: parsed.seed, log: parsed.log as Action[] }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/persistence/url.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/url.ts tests/persistence/url.test.ts
git commit -m "feat(persistence): encode/decode run to share url"
```

---

## Task 18: Replay engine

**Files:**
- Create: `src/persistence/replay.ts`
- Test: `tests/persistence/replay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { dispatch } from '../../src/core/dispatch'
import { replay } from '../../src/persistence/replay'
import type { Action } from '../../src/core/types'

describe('replay', () => {
  it('reproduces the final state of a recorded run', () => {
    const seed = 'replay-1'
    let w = createInitialWorld(seed)
    const log: Action[] = []
    const hero = w.actors[w.heroId]
    const move: Action = { type: 'MoveActor', actorId: w.heroId, to: { x: hero.pos.x + 1, y: hero.pos.y } }
    const before = w
    w = dispatch(w, move)
    if (w !== before) log.push(move)
    const advance: Action = { type: 'TurnAdvance' }
    w = dispatch(w, advance); log.push(advance)
    const replayed = replay(seed, log)
    expect(replayed.actors[replayed.heroId].pos).toEqual(w.actors[replayed.heroId].pos)
    expect(replayed.tick).toBe(w.tick)
  })
})
```

- [ ] **Step 2: Run, see it fail**

Run: `bun test tests/persistence/replay.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/persistence/replay.ts**

```ts
import { createInitialWorld } from '../core/state'
import { dispatch } from '../core/dispatch'
import type { Action, World } from '../core/types'

export function replay(seed: string, log: readonly Action[]): World {
  let state = createInitialWorld(seed)
  for (const action of log) state = dispatch(state, action)
  return state
}
```

- [ ] **Step 4: Run, see it pass**

Run: `bun test tests/persistence/replay.test.ts`
Expected: 1 pass.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/replay.ts tests/persistence/replay.test.ts
git commit -m "feat(persistence): action-log replay engine"
```

---

## Task 19: World canvas renderer

**Files:**
- Create: `src/render/world.ts`

*(No automated test — Canvas 2D pixel output is explicitly not tested per design spec §11. We manually verify in Task 23.)*

- [ ] **Step 1: Write src/render/world.ts**

```ts
import { Tile, type World } from '../core/types'
import { getArchetype } from '../content/loader'

export type RenderOptions = {
  tileSize: number
}

export function renderWorld(ctx: CanvasRenderingContext2D, state: World, opts: RenderOptions): void {
  const { tileSize } = opts
  const { floor } = state
  ctx.fillStyle = '#0b0612'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const t = floor.tiles[y * floor.width + x]
      if (t === Tile.Floor) {
        ctx.fillStyle = '#2a1c3a'
        ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1)
      } else if (t === Tile.Wall) {
        ctx.fillStyle = '#1a1024'
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
      }
    }
  }
  for (const id in state.actors) {
    const a = state.actors[id]
    if (!a.alive) continue
    const def = getArchetype(a.archetype)
    const cx = a.pos.x * tileSize + tileSize / 2
    const cy = a.pos.y * tileSize + tileSize / 2
    ctx.fillStyle = def.color
    ctx.beginPath()
    ctx.arc(cx, cy, tileSize * 0.35, 0, Math.PI * 2)
    ctx.fill()
    if (a.kind === 'enemy' || a.kind === 'hero') {
      ctx.fillStyle = '#120a1c'
      ctx.beginPath()
      ctx.arc(cx - tileSize * 0.1, cy - tileSize * 0.05, tileSize * 0.05, 0, Math.PI * 2)
      ctx.arc(cx + tileSize * 0.1, cy - tileSize * 0.05, tileSize * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `bun x tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/render/world.ts
git commit -m "feat(render): canvas 2d world + actor renderer"
```

---

## Task 20: DOM HUD (log + hp)

**Files:**
- Create: `src/ui/hud.ts`

*(No automated test — DOM structure is verified by reading it back in Task 23 smoke test.)*

**Constraint:** This file must build DOM with `createElement` / `textContent`. No `innerHTML`, no template strings assigned to DOM properties.

- [ ] **Step 1: Write src/ui/hud.ts**

```ts
import type { World } from '../core/types'

export type Hud = {
  update(state: World): void
  root: HTMLElement
}

export function mountHud(container: HTMLElement): Hud {
  container.replaceChildren()

  const root = document.createElement('div')
  root.id = 'hud-root'
  root.style.position = 'absolute'
  root.style.left = '12px'
  root.style.top = '12px'
  root.style.display = 'flex'
  root.style.flexDirection = 'column'
  root.style.gap = '8px'
  root.style.maxWidth = '360px'

  const hpPanel = document.createElement('div')
  hpPanel.style.background = 'rgba(18, 10, 28, 0.8)'
  hpPanel.style.border = '1px solid #5a3e8a'
  hpPanel.style.padding = '6px 10px'
  hpPanel.style.borderRadius = '6px'
  const hpLabel = document.createElement('div')
  hpLabel.style.fontSize = '14px'
  const hpBarOuter = document.createElement('div')
  hpBarOuter.style.marginTop = '4px'
  hpBarOuter.style.height = '6px'
  hpBarOuter.style.background = '#2a1c3a'
  hpBarOuter.style.borderRadius = '3px'
  const hpBarInner = document.createElement('div')
  hpBarInner.style.height = '100%'
  hpBarInner.style.background = '#e0bdf7'
  hpBarInner.style.borderRadius = '3px'
  hpBarInner.style.width = '100%'
  hpBarOuter.appendChild(hpBarInner)
  hpPanel.appendChild(hpLabel)
  hpPanel.appendChild(hpBarOuter)

  const logPanel = document.createElement('div')
  logPanel.style.background = 'rgba(18, 10, 28, 0.8)'
  logPanel.style.border = '1px solid #3e2a5c'
  logPanel.style.padding = '6px 10px'
  logPanel.style.borderRadius = '6px'
  logPanel.style.fontSize = '12px'
  logPanel.style.maxHeight = '160px'
  logPanel.style.overflow = 'hidden'

  root.appendChild(hpPanel)
  root.appendChild(logPanel)
  container.appendChild(root)

  function update(state: World): void {
    const hero = state.actors[state.heroId]
    if (hero) {
      hpLabel.textContent = `HP ${Math.max(0, hero.hp)} / ${hero.maxHp}`
      const ratio = Math.max(0, Math.min(1, hero.hp / hero.maxHp))
      hpBarInner.style.width = `${(ratio * 100).toFixed(0)}%`
    }
    logPanel.replaceChildren()
    const recent = state.log.slice(-8)
    for (const entry of recent) {
      const line = document.createElement('div')
      line.textContent = `[${entry.tick}] ${entry.text}`
      logPanel.appendChild(line)
    }
  }

  return { root, update }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun x tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts
git commit -m "feat(ui): hp + log hud (safe dom, no innerhtml)"
```

---

## Task 21: Overlay (win/lose + restart)

**Files:**
- Create: `src/ui/overlay.ts`

**Constraint:** No `innerHTML`. Build DOM via `createElement` / `textContent`.

- [ ] **Step 1: Write src/ui/overlay.ts**

```ts
import type { World } from '../core/types'

export type Overlay = {
  update(state: World): void
  onRestart(handler: () => void): void
  onShare(handler: () => void): void
}

export function mountOverlay(container: HTMLElement): Overlay {
  const root = document.createElement('div')
  root.id = 'overlay-root'
  root.style.position = 'absolute'
  root.style.inset = '0'
  root.style.display = 'none'
  root.style.alignItems = 'center'
  root.style.justifyContent = 'center'
  root.style.background = 'rgba(11, 6, 18, 0.75)'

  const card = document.createElement('div')
  card.style.background = '#1a1024'
  card.style.border = '1px solid #5a3e8a'
  card.style.padding = '24px 32px'
  card.style.borderRadius = '8px'
  card.style.textAlign = 'center'
  card.style.minWidth = '280px'

  const title = document.createElement('h1')
  title.style.margin = '0 0 12px 0'
  title.style.fontSize = '28px'
  title.style.color = '#f5e6b0'

  const subtitle = document.createElement('div')
  subtitle.style.margin = '0 0 16px 0'
  subtitle.style.color = '#c9b3e8'
  subtitle.style.fontSize = '13px'

  const buttons = document.createElement('div')
  buttons.style.display = 'flex'
  buttons.style.gap = '8px'
  buttons.style.justifyContent = 'center'

  const restartBtn = document.createElement('button')
  restartBtn.type = 'button'
  restartBtn.textContent = 'New run'
  styleButton(restartBtn)

  const shareBtn = document.createElement('button')
  shareBtn.type = 'button'
  shareBtn.textContent = 'Share URL'
  styleButton(shareBtn)

  buttons.appendChild(restartBtn)
  buttons.appendChild(shareBtn)
  card.appendChild(title)
  card.appendChild(subtitle)
  card.appendChild(buttons)
  root.appendChild(card)
  container.appendChild(root)

  let restartHandler: (() => void) | null = null
  let shareHandler: (() => void) | null = null
  restartBtn.addEventListener('click', () => { restartHandler?.() })
  shareBtn.addEventListener('click', () => { shareHandler?.() })

  function update(state: World): void {
    if (state.phase === 'run_won') {
      title.textContent = 'You broke the bone tide.'
      subtitle.textContent = `Tick ${state.tick}. Seed ${state.seed}.`
      root.style.display = 'flex'
    } else if (state.phase === 'run_lost') {
      title.textContent = 'You fell to the bone knights.'
      subtitle.textContent = `Tick ${state.tick}. Seed ${state.seed}.`
      root.style.display = 'flex'
    } else {
      root.style.display = 'none'
    }
  }

  return {
    update,
    onRestart(h) { restartHandler = h },
    onShare(h) { shareHandler = h },
  }
}

function styleButton(btn: HTMLButtonElement): void {
  btn.style.background = '#3e2a5c'
  btn.style.color = '#f5e6b0'
  btn.style.border = '1px solid #5a3e8a'
  btn.style.padding = '8px 16px'
  btn.style.borderRadius = '4px'
  btn.style.fontFamily = 'inherit'
  btn.style.fontSize = '14px'
  btn.style.cursor = 'pointer'
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun x tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/overlay.ts
git commit -m "feat(ui): run-end overlay with restart + share (safe dom)"
```

---

## Task 22: Dev input adapter (mouse + keyboard)

**Files:**
- Create: `src/input/dev.ts`

- [ ] **Step 1: Write src/input/dev.ts**

```ts
import type { Pos } from '../core/types'

export type DevInputHandlers = {
  onTileClick(tile: Pos): void
  onPauseToggle(): void
  onRestart(): void
}

export function attachDevInput(canvas: HTMLCanvasElement, tileSize: number, handlers: DevInputHandlers): () => void {
  function onClick(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY
    const tile = { x: Math.floor(px / tileSize), y: Math.floor(py / tileSize) }
    handlers.onTileClick(tile)
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === ' ') { e.preventDefault(); handlers.onPauseToggle() }
    else if (e.key.toLowerCase() === 'r') handlers.onRestart()
  }
  canvas.addEventListener('click', onClick)
  window.addEventListener('keydown', onKey)
  return () => {
    canvas.removeEventListener('click', onClick)
    window.removeEventListener('keydown', onKey)
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun x tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/input/dev.ts
git commit -m "feat(input): dev mouse + keyboard adapter"
```

---

## Task 23: Game loop + main wiring

**Files:**
- Modify: `src/main.ts`
- Create: `src/loop.ts`

- [ ] **Step 1: Write src/loop.ts**

```ts
import { dispatch } from './core/dispatch'
import { decide } from './ai/planner'
import { runOutcome } from './core/selectors'
import type { Action, World } from './core/types'

export type Loop = {
  start(): void
  stop(): void
  replaceState(next: World): void
  getState(): World
  submit(action: Action): void
  getLog(): readonly Action[]
}

export function createLoop(
  initial: World,
  onRender: (state: World) => void,
  opts: { enemyTickMs: number } = { enemyTickMs: 300 },
): Loop {
  let state = initial
  let log: Action[] = []
  let running = false
  let lastEnemyTick = 0

  function apply(action: Action): void {
    const before = state
    const after = dispatch(state, action)
    if (after === before) return
    state = after
    log.push(action)
    const outcome = runOutcome(state)
    if (outcome && state.phase === 'exploring') {
      const end: Action = { type: 'RunEnd', outcome }
      state = dispatch(state, end)
      log.push(end)
    }
  }

  function tick(now: number): void {
    if (!running) return
    if (state.phase === 'exploring' && now - lastEnemyTick >= opts.enemyTickMs) {
      lastEnemyTick = now
      const currentId = state.turnOrder[state.turnIndex]
      const actor = state.actors[currentId]
      if (actor && actor.kind !== 'hero' && actor.alive) {
        apply(decide(state, currentId))
      }
      apply({ type: 'TurnAdvance' })
    }
    onRender(state)
    requestAnimationFrame(tick)
  }

  return {
    start() {
      if (running) return
      running = true
      lastEnemyTick = performance.now()
      requestAnimationFrame(tick)
    },
    stop() { running = false },
    replaceState(next) { state = next; log = [] },
    getState() { return state },
    submit(action) { apply(action); onRender(state) },
    getLog() { return log },
  }
}
```

- [ ] **Step 2: Replace src/main.ts**

```ts
import { createInitialWorld } from './core/state'
import { createLoop } from './loop'
import { intentForClick } from './input/intent'
import { renderWorld } from './render/world'
import { mountHud } from './ui/hud'
import { mountOverlay } from './ui/overlay'
import { attachDevInput } from './input/dev'
import { encodeRun, decodeRun } from './persistence/url'
import { replay } from './persistence/replay'

const TILE_SIZE = 24

function randomSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function readUrlRun(): { seed: string; logApplied: boolean } {
  const params = new URLSearchParams(window.location.search)
  const run = params.get('run')
  if (run) {
    const decoded = decodeRun(run)
    if (decoded) return { seed: decoded.seed, logApplied: true }
  }
  const seed = params.get('seed') ?? randomSeed()
  return { seed, logApplied: false }
}

function main(): void {
  const canvas = document.getElementById('world') as HTMLCanvasElement
  const hudContainer = document.getElementById('hud') as HTMLDivElement
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  const params = new URLSearchParams(window.location.search)
  const startInfo = readUrlRun()
  let world = createInitialWorld(startInfo.seed)
  if (startInfo.logApplied) {
    const decoded = decodeRun(params.get('run')!)!
    world = replay(decoded.seed, decoded.log)
  }

  const hud = mountHud(hudContainer)
  const overlay = mountOverlay(hudContainer)

  const loop = createLoop(world, state => {
    renderWorld(ctx, state, { tileSize: TILE_SIZE })
    hud.update(state)
    overlay.update(state)
  })

  attachDevInput(canvas, TILE_SIZE, {
    onTileClick(tile) {
      const s = loop.getState()
      if (s.phase !== 'exploring') return
      const action = intentForClick(s, tile)
      if (action) loop.submit(action)
    },
    onPauseToggle() { /* 1A has no pause state; noop for now */ },
    onRestart() { loop.replaceState(createReplacement()) },
  })

  overlay.onRestart(() => { loop.replaceState(createReplacement()) })
  overlay.onShare(() => {
    const s = loop.getState()
    const encoded = encodeRun(s.seed, loop.getLog())
    const url = `${window.location.origin}${window.location.pathname}?dev=1&run=${encodeURIComponent(encoded)}`
    void navigator.clipboard?.writeText(url).catch(() => { /* ignore */ })
    window.prompt('Share URL (copy me):', url)
  })

  function createReplacement() {
    return createInitialWorld(randomSeed())
  }

  loop.start()
}

main()
```

- [ ] **Step 3: Verify build**

Run: `bun x tsc --noEmit`
Run: `bun x vite build`
Expected: both succeed.

- [ ] **Step 4: Smoke test in dev server**

Run: `bun x vite &`
Open: `http://localhost:5173/?dev=1`
Verify:
- A procgen floor renders with walls, floors, a hero dot, and bone-knight dots.
- Clicking an adjacent floor tile moves the hero.
- Clicking an adjacent enemy attacks it; log panel updates.
- After several turns the enemy hp drops and death removes the dot.
- Killing all enemies shows "You broke the bone tide." overlay with a Share URL button.
- Pressing `R` starts a fresh run.
- Clicking Share URL opens a prompt; pasting that URL in a new tab renders the same final state.

Stop dev server (kill the background process or Ctrl-C).

- [ ] **Step 5: Commit**

```bash
git add src/loop.ts src/main.ts
git commit -m "feat: wire game loop, input, render, hud, overlay"
```

---

## Task 24: Integration replay test

**Files:**
- Create: `tests/integration/full-run.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { dispatch } from '../../src/core/dispatch'
import { decide } from '../../src/ai/planner'
import { runOutcome } from '../../src/core/selectors'
import type { Action, World } from '../../src/core/types'

function simulate(seed: string, heroActions: Action[]): { final: World; log: Action[] } {
  let state = createInitialWorld(seed)
  const log: Action[] = []
  let heroIdx = 0
  const SAFETY = 2000
  for (let i = 0; i < SAFETY; i++) {
    const outcome = runOutcome(state)
    if (outcome) {
      const end: Action = { type: 'RunEnd', outcome }
      state = dispatch(state, end); log.push(end)
      break
    }
    const currentId = state.turnOrder[state.turnIndex]
    const actor = state.actors[currentId]
    if (actor && actor.kind === 'hero' && heroIdx < heroActions.length) {
      const a = heroActions[heroIdx++]
      const before = state
      state = dispatch(state, a)
      if (state !== before) log.push(a)
    } else if (actor && actor.kind !== 'hero' && actor.alive) {
      const a = decide(state, currentId)
      const before = state
      state = dispatch(state, a)
      if (state !== before) log.push(a)
    }
    const adv: Action = { type: 'TurnAdvance' }
    state = dispatch(state, adv); log.push(adv)
  }
  return { final: state, log }
}

function replayFromLog(seed: string, log: Action[]): World {
  let state = createInitialWorld(seed)
  for (const a of log) state = dispatch(state, a)
  return state
}

describe('full-run integration', () => {
  it('replays the same log to the same final state', () => {
    const seed = 'integration-1'
    const { final, log } = simulate(seed, [])
    const replayed = replayFromLog(seed, log)
    expect(replayed.tick).toBe(final.tick)
    expect(replayed.phase).toBe(final.phase)
    for (const id of Object.keys(final.actors)) {
      expect(replayed.actors[id].hp).toBe(final.actors[id].hp)
      expect(replayed.actors[id].alive).toBe(final.actors[id].alive)
      expect(replayed.actors[id].pos).toEqual(final.actors[id].pos)
    }
  })

  it('terminates with an outcome within the safety bound', () => {
    const seed = 'integration-2'
    const { final } = simulate(seed, [])
    expect(['run_won', 'run_lost']).toContain(final.phase)
  })
})
```

- [ ] **Step 2: Run it**

Run: `bun test tests/integration/full-run.test.ts`
Expected: 2 pass.

- [ ] **Step 3: Run the full suite**

Run: `bun test`
Expected: all tests pass (30+ individual assertions across ~12 test files).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/full-run.test.ts
git commit -m "test: full-run replay integration test"
```

---

## Task 25: README + smoke-test checklist

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# Skull Empires Revived

Browser-based, director-style roguelike. Phase 1A ships the playable core (one floor, one enemy archetype, win/lose, deterministic replay).

## Develop

Requires Bun 1.1+.

```
bun install
bun x vite
```

Open `http://localhost:5173/?dev=1`.

## Test

```
bun test
bun x tsc --noEmit
```

## Controls (Phase 1A, dev mode)

- **Left-click** an adjacent floor tile — move.
- **Left-click** an adjacent enemy — attack.
- **R** — new run (fresh seed).
- **Share URL** button on the end-of-run overlay — copy a URL that replays this run.

Gestures, voice, cards, dialog, multi-floor, boss, and FX ship in 1B–1E.

## Architecture

See `docs/plans/2026-04-17-skull-empires-revived-design.md` for the full design spec, and `docs/plans/2026-04-17-phase-1a-playable-core.md` for this sub-phase plan.

Core principle: pure-TS core, adapter layers are thin, action log is truth.
```

- [ ] **Step 2: Smoke-test checklist (manual, document the pass)**

Run the dev server and verify each bullet from "Ship criterion for 1A (done-when)" at the top of this plan. If any fails, open an issue-style note in the plan or fix forward.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: phase 1a readme + controls"
```

---

## Closing checks

After all 25 tasks:

- [ ] `bun test` — full suite green
- [ ] `bun x tsc --noEmit` — clean
- [ ] `bun x vite build` — clean
- [ ] Manual smoke test against the "Ship criterion for 1A" bullets passes
- [ ] CI green on master/main

Open 1B plan (cards + multi-floor + stairs) when this phase merges.
