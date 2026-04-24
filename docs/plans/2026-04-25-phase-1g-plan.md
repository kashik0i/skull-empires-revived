# Phase 1G Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking. Waves run in parallel internally; serialize between waves. Each task ends in one commit.

**Goal:** Implement Phase 1G per `docs/plans/2026-04-25-phase-1g-design.md` — camera deadzone + smooth follow, broadened screen shake, discrete zoom (keys / Ctrl-wheel / panel buttons), and a dev-menu button in the side panel.

**Architecture:** Two new pure-ish modules first (camera controller, zoom controller) — both fully testable in isolation. Then small surgical edits to existing modules (`presets.ts` shake triggers, `sidePanel.ts` slot list, `devMenu.ts` button helper, `input/dev.ts` tile-size getter). The integration pass in `main.ts` swaps the `TILE_SIZE` constant for `zoom.tileSize()` calls, replaces `computeCameraOffset` with `cameraController.update()`, and wires `snap()` to the existing `lastFloorKey` watcher and the zoom subscription.

**Tech Stack:** Bun + Vite + TypeScript strict, existing reducer/render pattern, no new deps.

**Working directory:** `.worktrees/phase-1g`
**Branch:** `feat/phase-1g`

**Conventions:**
- TDD for the pure modules (`cameraController`, `zoom`). DOM glue and `main.ts` wiring get a manual smoke pass at the end.
- Each task ends with `bun run typecheck` + relevant `bun test` + one commit.
- All paths relative to the worktree.
- World shape is unchanged — replay tests must keep passing.

---

## Setup

### T0: Worktree

- [ ] **Step 1:** From `master` create the worktree + branch.

```bash
cd /home/amr/source/repos/kashik0i/skull-empires-revived
git worktree add .worktrees/phase-1g -b feat/phase-1g master
cd .worktrees/phase-1g
bun install
bun run typecheck
bun test
```

Expected: clean typecheck, all tests pass (~209+).

---

## Wave 1 — Pure foundations (parallel-safe, 3 tasks)

### T1: Camera controller

**Files:**
- Create: `src/render/cameraController.ts`
- Create: `tests/render/cameraController.test.ts`

**Goal:** Stateful wrapper around the existing `computeCameraOffset` clamp. Adds a centered deadzone and a framerate-independent lerp. `snap()` skips lerp on the next frame for floor/zoom transitions.

- [ ] **Step 1: Write the failing test.**

`tests/render/cameraController.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { createCameraController } from '../../src/render/cameraController'

const tileSize = 24
const vw = 480, vh = 360       // 20x15 viewport in tiles
const fw = 100, fh = 100       // 100x100 floor (pixels: 2400x2400)

function update(c: ReturnType<typeof createCameraController>, hx: number, hy: number, dt = 16) {
  return c.update({
    heroDisplay: { x: hx, y: hy },
    tileSize,
    viewportW: vw, viewportH: vh,
    floorW: fw, floorH: fh,
    dtMs: dt,
  })
}

describe('cameraController', () => {
  it('snap puts current at the clamped target on first update', () => {
    const c = createCameraController()
    c.snap()
    const out = update(c, 50 * tileSize, 50 * tileSize)
    // hero center at 1212, viewport center at 240 → target.x = 1212 - 240 = 972
    expect(out.x).toBe(50 * tileSize + tileSize / 2 - vw / 2)
    expect(out.y).toBe(50 * tileSize + tileSize / 2 - vh / 2)
  })

  it('clamps target axis to 0 when floor fits viewport on that axis', () => {
    const c = createCameraController()
    c.snap()
    const out = c.update({
      heroDisplay: { x: 5 * tileSize, y: 5 * tileSize },
      tileSize, viewportW: 960, viewportH: 720,
      floorW: 10, floorH: 10, dtMs: 16,
    })
    expect(out).toEqual({ x: 0, y: 0 })
  })

  it('keeps target unchanged while hero stays inside the deadzone', () => {
    const c = createCameraController({ deadzoneFractionX: 0.4, deadzoneFractionY: 0.4 })
    c.snap()
    const a = update(c, 50 * tileSize, 50 * tileSize)
    // Deadzone half-width = 480 * 0.4 / 2 = 96px (4 tiles). One tile move stays inside.
    const b = update(c, 51 * tileSize, 50 * tileSize)
    expect(b.x).toBe(a.x)
    expect(b.y).toBe(a.y)
  })

  it('shifts target by exactly the overshoot once hero crosses deadzone edge', () => {
    const c = createCameraController({ deadzoneFractionX: 0.4, deadzoneFractionY: 0.4, lerpHz: 1e6 })
    c.snap()
    update(c, 50 * tileSize, 50 * tileSize) // establish camera target around hero
    // Push hero far right so it overshoots the deadzone right edge.
    const out = update(c, 80 * tileSize, 50 * tileSize, 1000)
    // hero center pixel = 80*24 + 12 = 1932; viewport right edge of deadzone in screen coords = vw/2 + dhw = 240 + 96 = 336
    // target.x such that hero screen-x = 336 → target.x = 1932 - 336 = 1596 (pre-clamp)
    // floor width pixels = 2400; max x = 2400 - 480 = 1920 → 1596 < 1920 so no clamp
    expect(out.x).toBe(1596)
  })

  it('lerp converges monotonically toward a constant target', () => {
    const c = createCameraController({ lerpHz: 12 })
    c.snap()
    update(c, 50 * tileSize, 50 * tileSize) // establish base
    // jump hero suddenly so target shifts; without snap, current lerps
    const positions = [] as number[]
    for (let i = 0; i < 20; i++) positions.push(update(c, 80 * tileSize, 50 * tileSize, 16).x)
    // monotonic non-decreasing (target is to the right)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1])
    }
    // approaches the clamped target (hero too far → target = 1596)
    expect(positions[positions.length - 1]).toBeGreaterThan(1500)
  })

  it('snap() forces the next update to land exactly on the target', () => {
    const c = createCameraController({ lerpHz: 12 })
    c.snap()
    update(c, 50 * tileSize, 50 * tileSize)
    // Without snap, the next big jump would lerp.
    c.snap()
    const out = update(c, 80 * tileSize, 50 * tileSize, 16)
    expect(out.x).toBe(1596) // exactly target, no lerp
  })

  it('current() reflects the most recent update output', () => {
    const c = createCameraController()
    c.snap()
    const out = update(c, 50 * tileSize, 50 * tileSize)
    expect(c.current()).toEqual(out)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
bun test tests/render/cameraController.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the controller.**

`src/render/cameraController.ts`:
```ts
import { computeCameraOffset, type CameraOffset } from './camera'

export type CameraController = {
  /** Advance one frame; returns and stores the new offset. */
  update(opts: {
    heroDisplay: { x: number; y: number }
    tileSize: number
    viewportW: number
    viewportH: number
    floorW: number
    floorH: number
    dtMs: number
  }): CameraOffset
  /** Skip lerp on next update — used when zoom changes or floor swaps. */
  snap(): void
  /** Most recent post-lerp offset. Pre-shake by design. */
  current(): CameraOffset
}

type Opts = {
  deadzoneFractionX?: number
  deadzoneFractionY?: number
  lerpHz?: number
}

export function createCameraController(opts: Opts = {}): CameraController {
  const dzx = opts.deadzoneFractionX ?? 0.3
  const dzy = opts.deadzoneFractionY ?? 0.3
  const lerpHz = opts.lerpHz ?? 12

  let cur: CameraOffset = { x: 0, y: 0 }
  let target: CameraOffset = { x: 0, y: 0 }
  let snapNext = true   // first update always snaps

  function clampToFloor(t: CameraOffset, args: {
    tileSize: number; viewportW: number; viewportH: number; floorW: number; floorH: number
  }): CameraOffset {
    // Reuse computeCameraOffset's clamp by pretending the hero is anywhere; we only use the clamping.
    const floorPxW = args.floorW * args.tileSize
    const floorPxH = args.floorH * args.tileSize
    const maxX = floorPxW - args.viewportW
    const maxY = floorPxH - args.viewportH
    const x = maxX <= 0 ? 0 : Math.max(0, Math.min(t.x, maxX))
    const y = maxY <= 0 ? 0 : Math.max(0, Math.min(t.y, maxY))
    return { x, y }
  }

  function nextTarget(opts2: {
    heroDisplay: { x: number; y: number }
    tileSize: number
    viewportW: number
    viewportH: number
    floorW: number
    floorH: number
  }): CameraOffset {
    const hpx = opts2.heroDisplay.x + opts2.tileSize / 2
    const hpy = opts2.heroDisplay.y + opts2.tileSize / 2
    const vcx = opts2.viewportW / 2
    const vcy = opts2.viewportH / 2
    const dhw = opts2.viewportW * dzx / 2
    const dhh = opts2.viewportH * dzy / 2

    // Hero screen position given current target (deadzone is anchored to current target, not lerped current).
    const hsx = hpx - target.x
    const hsy = hpy - target.y

    let tx = target.x
    let ty = target.y
    if (hsx < vcx - dhw) tx = hpx - (vcx - dhw)
    else if (hsx > vcx + dhw) tx = hpx - (vcx + dhw)
    if (hsy < vcy - dhh) ty = hpy - (vcy - dhh)
    else if (hsy > vcy + dhh) ty = hpy - (vcy + dhh)

    // First-ever update: there's no prior target, center on hero (use computeCameraOffset for the seed).
    return clampToFloor({ x: tx, y: ty }, opts2)
  }

  return {
    update(args) {
      // Bootstrap: when snapping from {0,0}, seed target to the centered offset to avoid a one-frame jump.
      if (snapNext) {
        target = computeCameraOffset(args.heroDisplay, args.tileSize, args.viewportW, args.viewportH, args.floorW, args.floorH)
        cur = target
        snapNext = false
        return cur
      }
      target = nextTarget(args)
      const k = 1 - Math.exp(-args.dtMs * lerpHz / 1000)
      cur = {
        x: cur.x + (target.x - cur.x) * k,
        y: cur.y + (target.y - cur.y) * k,
      }
      return cur
    },
    snap() { snapNext = true },
    current() { return cur },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes.**

```bash
bun test tests/render/cameraController.test.ts
```

Expected: PASS for all six cases.

- [ ] **Step 5: Typecheck and commit.**

```bash
bun run typecheck
git add src/render/cameraController.ts tests/render/cameraController.test.ts
git commit -m "feat(camera): controller with deadzone + smooth follow + snap"
```

---

### T2: Zoom controller

**Files:**
- Create: `src/ui/zoom.ts`
- Create: `tests/ui/zoom.test.ts`

**Goal:** A small subscribable controller over a discrete tile-size step list, persisted to localStorage.

- [ ] **Step 1: Write the failing test.**

`tests/ui/zoom.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'bun:test'
import { createZoom, ZOOM_STEPS, ZOOM_DEFAULT_INDEX } from '../../src/ui/zoom'

function mockLocalStorage(initial?: string): Storage {
  let value = initial ?? null
  const store: Storage = {
    get length() { return value === null ? 0 : 1 },
    clear() { value = null },
    getItem: (k: string) => k === 'zoom_index' ? value : null,
    key: () => null,
    removeItem: (k: string) => { if (k === 'zoom_index') value = null },
    setItem: (k: string, v: string) => { if (k === 'zoom_index') value = v },
  }
  return store
}

beforeEach(() => {
  ;(globalThis as any).localStorage = mockLocalStorage()
})

describe('zoom', () => {
  it('starts at the default tile size', () => {
    const z = createZoom()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_DEFAULT_INDEX])
  })

  it('zoomIn and zoomOut step through the list and clamp at the ends', () => {
    const z = createZoom()
    for (let i = 0; i < 10; i++) z.zoomIn()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1])
    for (let i = 0; i < 10; i++) z.zoomOut()
    expect(z.tileSize()).toBe(ZOOM_STEPS[0])
  })

  it('reset returns to the default', () => {
    const z = createZoom()
    z.zoomIn()
    z.reset()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_DEFAULT_INDEX])
  })

  it('subscribers fire on change and not on no-op', () => {
    const z = createZoom()
    let calls = 0
    z.subscribe(() => calls++)
    z.zoomIn()
    expect(calls).toBe(1)
    // Move to max, then zoomIn again should be a no-op.
    while (z.tileSize() !== ZOOM_STEPS[ZOOM_STEPS.length - 1]) z.zoomIn()
    const before = calls
    z.zoomIn()
    expect(calls).toBe(before)
  })

  it('reads localStorage on construct', () => {
    ;(globalThis as any).localStorage = mockLocalStorage('3') // index 3 → 36px
    const z = createZoom()
    expect(z.tileSize()).toBe(ZOOM_STEPS[3])
  })

  it('writes localStorage on change', () => {
    const ls = mockLocalStorage()
    ;(globalThis as any).localStorage = ls
    const z = createZoom()
    z.zoomIn()
    expect(ls.getItem('zoom_index')).toBe(String(ZOOM_DEFAULT_INDEX + 1))
  })

  it('ignores out-of-range persisted values and falls back to default', () => {
    ;(globalThis as any).localStorage = mockLocalStorage('99')
    const z = createZoom()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_DEFAULT_INDEX])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
bun test tests/ui/zoom.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the controller.**

`src/ui/zoom.ts`:
```ts
export const ZOOM_STEPS = [18, 24, 30, 36, 48] as const
export const ZOOM_DEFAULT_INDEX = 1
const STORAGE_KEY = 'zoom_index'

export type ZoomController = {
  tileSize(): number
  index(): number
  zoomIn(): void
  zoomOut(): void
  reset(): void
  subscribe(cb: (tileSize: number) => void): () => void
}

export function createZoom(): ZoomController {
  let idx = readPersistedIndex()
  const subs: Array<(t: number) => void> = []

  function setIndex(next: number): void {
    const clamped = Math.max(0, Math.min(ZOOM_STEPS.length - 1, next))
    if (clamped === idx) return
    idx = clamped
    try { localStorage.setItem(STORAGE_KEY, String(idx)) } catch {}
    const ts = ZOOM_STEPS[idx]
    for (const cb of subs) cb(ts)
  }

  return {
    tileSize: () => ZOOM_STEPS[idx],
    index: () => idx,
    zoomIn: () => setIndex(idx + 1),
    zoomOut: () => setIndex(idx - 1),
    reset: () => setIndex(ZOOM_DEFAULT_INDEX),
    subscribe(cb) {
      subs.push(cb)
      return () => {
        const i = subs.indexOf(cb)
        if (i >= 0) subs.splice(i, 1)
      }
    },
  }
}

function readPersistedIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return ZOOM_DEFAULT_INDEX
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0 || n >= ZOOM_STEPS.length) return ZOOM_DEFAULT_INDEX
    return n
  } catch {
    return ZOOM_DEFAULT_INDEX
  }
}
```

- [ ] **Step 4: Run the test to verify it passes.**

```bash
bun test tests/ui/zoom.test.ts
```

Expected: PASS for all seven cases.

- [ ] **Step 5: Typecheck and commit.**

```bash
bun run typecheck
git add src/ui/zoom.ts tests/ui/zoom.test.ts
git commit -m "feat(ui): zoom controller with discrete steps + localStorage"
```

---

### T3: Side panel slot expansion

**Files:**
- Modify: `src/ui/sidePanel.ts` (slot order + type union)

**Goal:** Add `'zoom'` and `'dev'` to the slot list. No new behavior — just expanded shape.

- [ ] **Step 1: Edit slot type and order.**

In `src/ui/sidePanel.ts`, find the `slot()` typing:
```ts
slot(name: 'minimap' | 'stats' | 'equipment' | 'inventory' | 'music' | 'descend'): HTMLElement
```
Change to:
```ts
slot(name: 'minimap' | 'stats' | 'equipment' | 'inventory' | 'zoom' | 'music' | 'descend' | 'dev'): HTMLElement
```

Find the order constant:
```ts
const order = ['minimap', 'stats', 'equipment', 'inventory', 'music', 'descend'] as const
```
Change to:
```ts
const order = ['minimap', 'stats', 'equipment', 'inventory', 'zoom', 'music', 'descend', 'dev'] as const
```

- [ ] **Step 2: Typecheck.**

```bash
bun run typecheck
```

Expected: clean. Existing `slot('minimap' | ...)` calls in main.ts still type-match because the union expanded.

- [ ] **Step 3: Test (light — existing tests cover this).**

```bash
bun test tests/ui/
```

Expected: pass (no regressions).

- [ ] **Step 4: Commit.**

```bash
git add src/ui/sidePanel.ts
git commit -m "feat(ui): add zoom + dev slots to side panel"
```

---

## Wave 2 — Surgical edits to existing modules (sequential, 3 tasks)

### T4: Broaden shake triggers (and accept tileSize)

**Files:**
- Modify: `src/render/fx/presets.ts`

**Goal:** Tune the existing hero-damage shake, add shake on non-hero death and `run-ended` loss, and make `wirePresets` read tile size dynamically so zoom doesn't desync FX positions.

- [ ] **Step 1: Replace `wirePresets` to take a tile-size getter.**

Current first lines of `src/render/fx/presets.ts`:
```ts
const TILE_SIZE = 24

function posPx(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 }
}

export function wirePresets(
  bus: FxBus,
  canvas: FxCanvas,
  particles: ParticlePool,
  display: DisplayState,
): () => void {
```

Replace with:
```ts
export function wirePresets(
  bus: FxBus,
  canvas: FxCanvas,
  particles: ParticlePool,
  display: DisplayState,
  getTileSize: () => number = () => 24,
): () => void {
  const tileSize = () => getTileSize()
  const posPx = (x: number, y: number) => ({
    x: x * tileSize() + tileSize() / 2,
    y: y * tileSize() + tileSize() / 2,
  })
```

(Remove the old top-level `TILE_SIZE` const and the old `posPx`. The default arg keeps existing tests/callers working at 24px.)

- [ ] **Step 2: Replace the `damaged` shake parameters.**

Current line:
```ts
canvas.spawnShake({ amplitudePx: 3, freqHz: 40, ageMs: 0, lifeMs: 100 })
```
Change to:
```ts
canvas.spawnShake({ amplitudePx: 4, freqHz: 40, ageMs: 0, lifeMs: 200 })
```

- [ ] **Step 3: Add shake on non-hero death.**

In the `case 'died':` block (currently emits a particle burst), append after the existing `particles.emit({...})` call:
```ts
canvas.spawnShake({ amplitudePx: 2, freqHz: 50, ageMs: 0, lifeMs: 120 })
```

- [ ] **Step 4: Add shake on `run-ended` loss.**

Replace the existing empty `case 'run-ended':` block with:
```ts
case 'run-ended': {
  if (event.outcome === 'lost') {
    canvas.spawnShake({ amplitudePx: 8, freqHz: 35, ageMs: 0, lifeMs: 500 })
  }
  return
}
```

- [ ] **Step 5: Replace any remaining bare `TILE_SIZE` references inside presets.ts.**

Search for `TILE_SIZE` in the file — every occurrence must become `tileSize()`. This affects flash radii and float offsets.

```bash
grep -n 'TILE_SIZE' src/render/fx/presets.ts
```

Expected: zero matches after this step.

- [ ] **Step 6: Typecheck and run all tests.**

```bash
bun run typecheck
bun test
```

Expected: pass — no test currently asserts shake parameters; presets is glue.

- [ ] **Step 7: Commit.**

```bash
git add src/render/fx/presets.ts
git commit -m "feat(fx): broaden shake (death, run-loss) + dynamic tileSize"
```

---

### T5: Dev input — tileSize getter

**Files:**
- Modify: `src/input/dev.ts`

**Goal:** Make the canvas-click handler read tile size at click time so zoom doesn't break click-to-tile.

- [ ] **Step 1: Change the signature.**

In `src/input/dev.ts`, change:
```ts
export function attachDevInput(
  canvas: HTMLCanvasElement,
  tileSize: number,
  handlers: DevInputHandlers,
  cameraOffsetGetter: () => CameraOffset = () => ({ x: 0, y: 0 }),
): () => void {
```
to:
```ts
export function attachDevInput(
  canvas: HTMLCanvasElement,
  tileSizeGetter: () => number,
  handlers: DevInputHandlers,
  cameraOffsetGetter: () => CameraOffset = () => ({ x: 0, y: 0 }),
): () => void {
```

And change the inner `screenToWorldTile(...)` call's `tileSize` argument from `tileSize` to `tileSizeGetter()`:
```ts
const tile = screenToWorldTile(
  e.clientX,
  e.clientY,
  rect,
  { width: canvas.width, height: canvas.height },
  tileSizeGetter(),
  cameraOffsetGetter(),
)
```

- [ ] **Step 2: Typecheck.**

```bash
bun run typecheck
```

Expected: FAIL at the `attachDevInput(worldCanvas, TILE_SIZE, ...)` call site in `src/main.ts`. We'll fix that in T7.

- [ ] **Step 3: Commit (interim — typecheck will pass once T7 lands).**

```bash
git add src/input/dev.ts
git commit -m "refactor(input): tileSize getter for live zoom support"
```

---

### T6: Dev menu button helper

**Files:**
- Modify: `src/ui/devMenu.ts`

**Goal:** Add `mountDevMenuButton(parent, devMenu)` next to `mountDevMenu`. One small button styled like the music pause button.

- [ ] **Step 1: Append the helper at the bottom of `src/ui/devMenu.ts`.**

After `attachDevMenuHotkey`, add:
```ts
export function mountDevMenuButton(parent: HTMLElement, devMenu: DevMenu): void {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = 'Dev menu'
  btn.title = 'Toggle dev menu (`)'
  Object.assign(btn.style, {
    background: '#2a1a3e',
    color: '#eadbc0',
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    width: '100%',
  } satisfies Partial<CSSStyleDeclaration>)
  btn.addEventListener('click', () => devMenu.toggle())
  parent.appendChild(btn)
}
```

- [ ] **Step 2: Typecheck.**

```bash
bun run typecheck
```

Expected: still FAILS at T5's main.ts call site, but no new errors.

- [ ] **Step 3: Commit.**

```bash
git add src/ui/devMenu.ts
git commit -m "feat(ui): mountDevMenuButton helper"
```

---

## Wave 3 — Integration

### T7: Wire main.ts

**Files:**
- Modify: `src/main.ts`

**Goal:** Replace the `TILE_SIZE` constant with `zoom.tileSize()` everywhere, swap `computeCameraOffset` for `cameraController.update()`, mount the zoom row + dev-menu button, and add zoom inputs (keys + Ctrl-wheel).

- [ ] **Step 1: Imports.**

At the top of `src/main.ts`, add:
```ts
import { createCameraController } from './render/cameraController'
import { createZoom, ZOOM_STEPS, ZOOM_DEFAULT_INDEX } from './ui/zoom'
import { mountDevMenuButton } from './ui/devMenu'
```

(`mountDevMenuButton` joins the existing `import { mountDevMenu, attachDevMenuHotkey } from './ui/devMenu'` — adjust the named import list rather than adding a duplicate line.)

Remove the `import { computeCameraOffset } from './render/camera'` line — the controller imports it internally. **Keep the type-only import on the next line:** `import type { CameraOffset } from './render/camera'` (still used for the `cameraOffset` local).

- [ ] **Step 2: Delete the `TILE_SIZE` constant and replace with the zoom controller.**

Find and delete:
```ts
const TILE_SIZE = 24
```

Just before the existing `let cameraOffset: CameraOffset = { x: 0, y: 0 }` line, add:
```ts
const zoom = createZoom()
const camera = createCameraController()
```

- [ ] **Step 3: Replace `computeCameraOffset` call inside the loop's per-frame callback.**

Find this block:
```ts
const heroDisp = display.get(state.heroId) ?? state.actors[state.heroId].pos
cameraOffset = computeCameraOffset(
  { x: heroDisp.x * TILE_SIZE, y: heroDisp.y * TILE_SIZE },
  TILE_SIZE,
  worldCanvas.width,
  worldCanvas.height,
  state.floor.width,
  state.floor.height,
)
```

Replace with:
```ts
const heroDisp = display.get(state.heroId) ?? state.actors[state.heroId].pos
const tileSize = zoom.tileSize()
cameraOffset = camera.update({
  heroDisplay: { x: heroDisp.x * tileSize, y: heroDisp.y * tileSize },
  tileSize,
  viewportW: worldCanvas.width,
  viewportH: worldCanvas.height,
  floorW: state.floor.width,
  floorH: state.floor.height,
  dtMs,
})
```

- [ ] **Step 4: Snap on floor change.**

The existing floor-change watcher:
```ts
const nextKey = floorKey(state)
if (nextKey !== lastFloorKey) {
  seenTiles = new Uint8Array(state.floor.width * state.floor.height)
  lastFloorKey = nextKey
}
```

Add `camera.snap()` inside the if-block:
```ts
if (nextKey !== lastFloorKey) {
  seenTiles = new Uint8Array(state.floor.width * state.floor.height)
  lastFloorKey = nextKey
  camera.snap()
}
```

Also call `camera.snap()` at the end of `createReplacement()` (after `lastFloorKey = floorKey(newWorld)`), so a restart resets the camera.

- [ ] **Step 5: Replace remaining `TILE_SIZE` references with `zoom.tileSize()`.**

Find every `TILE_SIZE` usage in the per-frame callback and downstream:
- `tileSize: TILE_SIZE` in the `renderWorld` opts → `tileSize: zoom.tileSize()` (or reuse the local `tileSize` from step 3 if in the same closure).
- `attachDevInput(worldCanvas, TILE_SIZE, ...)` → `attachDevInput(worldCanvas, () => zoom.tileSize(), ...)`.

Run a sanity grep to confirm zero remaining matches in `src/main.ts`:
```bash
grep -n 'TILE_SIZE' src/main.ts
```

Expected: empty.

- [ ] **Step 6: Pass tile-size getter to `wirePresets`.**

Find:
```ts
wirePresets(bus, fx, particles, display)
```
Change to:
```ts
wirePresets(bus, fx, particles, display, () => zoom.tileSize())
```

- [ ] **Step 7: Mount the zoom row in the side panel.**

After the existing side-panel mounts (e.g. just before the music control mount at `mountMusicControls(panel.slot('music'), music)`), add:
```ts
mountZoomRow(panel.slot('zoom'), zoom)
```

…and define `mountZoomRow` inline near the top of `main.ts` (or as a private helper):
```ts
function mountZoomRow(parent: HTMLElement, zoom: ReturnType<typeof createZoom>): void {
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

  const out = document.createElement('button')
  out.type = 'button'
  out.textContent = '−'
  out.title = 'Zoom out (-)'

  const readout = document.createElement('span')
  readout.style.flex = '1'
  readout.style.textAlign = 'center'

  const inb = document.createElement('button')
  inb.type = 'button'
  inb.textContent = '+'
  inb.title = 'Zoom in (+)'

  for (const b of [out, inb]) {
    Object.assign(b.style, {
      background: '#2a1a3e',
      color: '#eadbc0',
      border: '1px solid #5a3e8a',
      borderRadius: '4px',
      padding: '4px 8px',
      cursor: 'pointer',
      fontSize: '12px',
      minWidth: '28px',
    } satisfies Partial<CSSStyleDeclaration>)
  }

  function refresh() {
    const pct = Math.round(zoom.tileSize() / ZOOM_STEPS[ZOOM_DEFAULT_INDEX] * 100)
    readout.textContent = `${pct}%`
  }
  refresh()
  zoom.subscribe(refresh)

  out.addEventListener('click', () => zoom.zoomOut())
  inb.addEventListener('click', () => zoom.zoomIn())

  root.appendChild(out)
  root.appendChild(readout)
  root.appendChild(inb)
  parent.appendChild(root)
}
```

- [ ] **Step 8: Mount the dev-menu button.**

Just after `attachDevMenuHotkey(devMenu)`, add:
```ts
mountDevMenuButton(panel.slot('dev'), devMenu)
```

- [ ] **Step 9: Wire keyboard zoom.**

Near the existing `attachDevMenuHotkey` / `attachDevInput` setup, add a single `keydown` listener:
```ts
window.addEventListener('keydown', (e) => {
  if (loop.getState().pendingDialog !== null) return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom.zoomIn() }
  else if (e.key === '-') { e.preventDefault(); zoom.zoomOut() }
  else if (e.key === '0') { e.preventDefault(); zoom.reset() }
})
```

- [ ] **Step 10: Wire Ctrl-wheel zoom on canvas.**

After the canvas is set up:
```ts
let lastZoomMs = 0
worldCanvas.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return
  e.preventDefault()
  const now = performance.now()
  if (now - lastZoomMs < 80) return
  lastZoomMs = now
  if (e.deltaY < 0) zoom.zoomIn()
  else if (e.deltaY > 0) zoom.zoomOut()
}, { passive: false })
```

- [ ] **Step 11: Subscribe to zoom changes for camera snap.**

After `zoom` is constructed:
```ts
zoom.subscribe(() => camera.snap())
```

- [ ] **Step 12: Typecheck.**

```bash
bun run typecheck
```

Expected: clean.

- [ ] **Step 13: Run all tests.**

```bash
bun test
```

Expected: PASS — same count as before plus the new `cameraController` and `zoom` suites.

- [ ] **Step 14: Commit.**

```bash
git add src/main.ts
git commit -m "feat: phase 1g wire-up (camera, zoom, dev-menu button)"
```

---

## Wave 4 — Smoke

### T8: Smoke checklist

**Files:**
- Create: `docs/SMOKE-PHASE-1G.md`

- [ ] **Step 1: Start the dev server.**

```bash
bun run dev
```

Open the printed URL.

- [ ] **Step 2: Walk the checklist below in order, then save it as `docs/SMOKE-PHASE-1G.md` with results filled in.**

```markdown
# Phase 1G smoke checklist

Date: <YYYY-MM-DD>

## Camera
- [ ] Move hero one tile in any direction near the floor center → camera does NOT pan (hero is inside deadzone).
- [ ] Move hero many tiles toward an edge → camera pans smoothly (visible easing, not jitter).
- [ ] Stand at a wall in the corner → camera clamps; hero is offset toward that corner on screen.
- [ ] Descend stairs → camera does NOT visibly drift across the transition.

## Zoom
- [ ] Press `+` → tiles get bigger; minimap window proportionally shrinks.
- [ ] Press `-` → tiles get smaller; more world visible.
- [ ] Press `0` → returns to 100%.
- [ ] Click the panel `−` / `+` buttons → same behavior as keys; readout updates.
- [ ] Hold Ctrl (or ⌘ on macOS) and scroll wheel on canvas → zoom steps. A single brisk trackpad swipe steps once or twice, NOT all the way to max.
- [ ] Plain wheel (no modifier) does nothing on canvas; page scroll behaves normally.
- [ ] Reload the page → zoom level persists.

## Click correctness
- [ ] At each zoom level, click a wall and a floor tile → highlight (or movement attempt) lands on the tile under the cursor, not next to it.
- [ ] Trigger a hit and watch shake → during the shake, clicking still hits the tile under the cursor (shake doesn't fold into click math).

## Shake
- [ ] Hero takes damage → noticeable kick (≈4px, 200ms).
- [ ] Kill an enemy → small kick (≈2px, 120ms).
- [ ] Die → strong kick (≈8px, 500ms).
- [ ] Win the run → no shake.

## Dev menu button
- [ ] Side panel shows a "Dev menu" button at the bottom.
- [ ] Click → menu opens. Click again → closes.
- [ ] Hotkey `` ` `` still works.
- [ ] On mobile (devtools touch emulation): drawer expands → button visible and tappable.

## Regressions
- [ ] Music play/pause + volume still work.
- [ ] Inventory + equip flow still works.
- [ ] Minimap focused/full toggle still works.
- [ ] Replay from URL still works.
```

- [ ] **Step 3: Commit the smoke doc.**

```bash
git add docs/SMOKE-PHASE-1G.md
git commit -m "docs: phase 1g smoke checklist"
```

---

## Final

### T9: Merge

- [ ] **Step 1: Verify clean state.**

```bash
bun run typecheck
bun test
```

Expected: clean + all tests pass.

- [ ] **Step 2: Bring back to master worktree and merge.**

```bash
cd /home/amr/source/repos/kashik0i/skull-empires-revived
git merge feat/phase-1g --no-ff -m "Phase 1G: camera feel + zoom + dev-menu button"
```

Or, if the worktree convention from earlier phases was a `git reset --hard feat/phase-1g` from master, ask the user which they prefer before running.

- [ ] **Step 3: Remove the worktree.**

```bash
git worktree remove .worktrees/phase-1g
git branch -d feat/phase-1g
```
