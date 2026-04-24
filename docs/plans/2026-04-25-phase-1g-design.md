# Phase 1G — Camera Feel + Zoom + Dev-Menu Button

**Status:** Design (approved 2026-04-25)
**Goal:** Make the camera feel less twitchy (deadzone + smooth follow), broaden screen-shake feedback, let the player zoom in/out, and surface the dev menu through the side panel instead of only via the `` ` `` hotkey.

## Why

Phase 1F finished the layout refresh, so the play canvas is now a stable rectangle inside a CSS grid cell. With the layout settled, the camera became the next thing that feels rough: today it snaps pixel-for-pixel to the hero every frame, which makes small hero motions feel jittery and large floors feel claustrophobic. Screen shake is wired but only fires on hero damage, so kills and run-loss have no kinetic feedback. And the dev menu, useful for non-developer playtesters too (FPS, pause, invincible), is gated behind a hotkey nobody discovers.

This phase is presentation/feel polish. No gameplay rules change.

## Non-goals

- Camera modes per floor (locked-room, side-scroller, isometric).
- Recoil/knockback on hits — purely visual shake only.
- Pinch-zoom on mobile (single-tap stays the input model; zoom is buttons + keys + Ctrl-wheel).
- Shake intensity tuning per archetype.
- Reorganizing the dev menu's contents — only adding a button to open it.
- Saving camera state per run.

## Architecture

### Camera controller

New file `src/render/cameraController.ts`. Wraps the existing pure helpers in `camera.ts`; those helpers stay and are still used (and still tested) for clamping math and screen↔world conversion.

```ts
export type CameraController = {
  update(opts: {
    heroDisplay: { x: number; y: number }
    tileSize: number
    viewportW: number
    viewportH: number
    floorW: number
    floorH: number
    dtMs: number
  }): { x: number; y: number }
  /** Skip lerp on next update — used when zoom changes or floor swaps. */
  snap(): void
  /** Current offset (post-lerp, pre-shake). This is what `screenToWorldTile` should use; shake is layered into the render translate elsewhere and must NOT be added here. */
  current(): { x: number; y: number }
}

export function createCameraController(opts?: {
  deadzoneFractionX?: number    // default 0.3
  deadzoneFractionY?: number    // default 0.3
  lerpHz?: number               // default 12
}): CameraController
```

**Deadzone math.** The hero center in viewport coords is `heroPx + tileSize/2 - cameraOffset`. The deadzone is a centered rectangle of size `viewportW * dz` × `viewportH * dz`. If the hero is inside it, the **target** stays at its previous value. If the hero is outside on either axis, the target shifts by exactly enough to put the hero back on the deadzone edge. The target is then clamped to floor bounds via `computeCameraOffset` semantics (clamp logic only — the centering pass is replaced).

**Smooth follow.** Per-frame lerp factor = `1 - exp(-dtMs * lerpHz / 1000)` (framerate-independent). Apply to current position toward target.

**Snap.** Set current = target on next update, skipping lerp. Triggered on floor change and zoom change so the camera doesn't drift visibly during a transition.

### Shake — extend, don't rebuild

`src/render/fx/canvas.ts` already has `spawnShake({ amplitudePx, freqHz, ageMs, lifeMs })` and `world.ts` already adds `shakeOffset` to the canvas translate. Only `presets.ts` changes:

- Hero `damaged` (existing): bump from `(3px, 100ms)` to `(4px, 200ms)`. Same `freqHz: 40`.
- Non-hero `died` (new): `(2px, 120ms)`, `freqHz: 50`.
- `run-ended` outcome=`lost` (new): `(8px, 500ms)`, `freqHz: 35`. Outcome=`won` gets no shake — the win flow is celebratory, not a jolt.

Shake offset stays out of `screenToWorldTile` — clicks must hit the tile the player sees centered, not the tile under the jiggle.

### Zoom

A small zoom controller with discrete steps. Replaces the hardcoded `TILE_SIZE = 24` in `main.ts` and the duplicate `TILE_SIZE = 24` in `presets.ts`.

```ts
// src/ui/zoom.ts
export type ZoomController = {
  tileSize(): number
  zoomIn(): void
  zoomOut(): void
  reset(): void
  subscribe(cb: (tileSize: number) => void): () => void
}

const STEPS = [18, 24, 30, 36, 48]   // px per tile
const DEFAULT_INDEX = 1               // 24px
```

- Persisted as `localStorage.zoom_index` (integer).
- `subscribe` notifies on change so main.ts can `cameraController.snap()` and resize anything that caches tile-derived sizes.

**Inputs:**
- Keyboard: `+` / `=` zooms in, `-` zooms out, `0` resets. Ignored when a modal/dialog is open and when the dev menu has focus on a number input.
- Wheel on canvas with `Ctrl` or `⌘` held. `e.preventDefault()` to suppress browser zoom on the page itself. Bare wheel does nothing (don't hijack page scroll).
- Side panel: a tiny zoom row in a new `'zoom'` slot — `[−] 100% [+]`. The percentage is `tileSize / 24 * 100` rounded.

**Renderer wiring.** `main.ts` reads `zoom.tileSize()` once per frame and passes it to all `worldRender`, `presets`, click-to-tile, and camera controller calls. `presets.ts` accepts `tileSize` via the existing `wirePresets` opts (currently it captures `TILE_SIZE = 24` at module scope; that becomes a function arg or a closure over `getTileSize`).

### Dev-menu button in side panel

- Add `'dev'` to `slot()` typing and the slot order in `src/ui/sidePanel.ts` (last position).
- New file `src/ui/devMenuButton.ts`:
  ```ts
  export function mountDevMenuButton(parent: HTMLElement, devMenu: DevMenu): void
  ```
  Renders one small button styled like the music pause toggle — text "Dev menu", `title="Toggle dev menu (\`)"`, calls `devMenu.toggle()` on click.
- `main.ts` mounts it on `panel.slot('dev')` after `mountDevMenu`.
- The hotkey `` ` `` and the in-menu hint stay.

### Final side panel slot order

`minimap, stats, equipment, inventory, zoom, music, descend, dev`

## Data flow

```
              ┌────────────────────┐
   keys/wheel │   ZoomController   │  localStorage
   + buttons →│   tileSize state   ├→──────────────
              └─────────┬──────────┘
                        │ tileSize
                        ▼
   hero pos ──→  ┌────────────────────┐ ──→ render translate
   floor    ──→  │  CameraController  │ ──→ minimap window math
   viewport ──→  │  (deadzone + lerp) │ ──→ screenToWorldTile
                 └────────────────────┘
                        ▲
                        │ snap() on zoom change / floor change

   FxBus events ──→ presets.ts ──→ canvas.spawnShake ──→ shakeOffset
                                                          │
                                                          ▼
                                                   render translate
```

## Tests

New unit tests, all in Bun:

- `cameraController.test.ts`
  - Hero centered → camera centers (target = clamped center).
  - Hero moves inside deadzone → target unchanged.
  - Hero crosses deadzone edge → target shifts by exactly the overshoot.
  - Lerp converges: feeding many frames with constant target reduces distance monotonically and reaches target within tolerance.
  - `snap()` skips lerp on the next update.
  - Floor smaller than viewport on an axis → that axis offset stays 0 regardless of hero pos.

- `zoom.test.ts`
  - `zoomIn`/`zoomOut` step through `[18, 24, 30, 36, 48]` and clamp at ends.
  - `reset()` returns to default 24.
  - Subscriber receives new size on change, not on no-op (e.g. zoomIn at max).
  - `localStorage` is read on construct, written on change. Use a simple in-memory shim for the test.

No new test for the dev-menu button — wiring is one click handler.

## Risks / known footguns

1. **TILE_SIZE leakage.** The constant is duplicated in `presets.ts` (line 7) and may be referenced elsewhere — implementation must grep and remove all literal-24 dependencies, replacing with the dynamic value. Anything missed will visibly desync from zoom.
2. **Camera target jump on floor change.** The current camera helper recenters instantly. The new controller must also reset on floor swap (call `snap()` from the existing floor-load code path) or the new floor will visibly lerp from the old camera position.
3. **Wheel on touchpads.** `deltaY` from touchpads can fire continuously with small magnitudes. Mitigation: zoom is `Ctrl`/`⌘`+wheel only (already specified); each `wheel` event with the modifier held steps once per event regardless of `deltaY` magnitude, so a fast scroll doesn't blow through all five steps.
4. **Click coordinates after zoom.** `screenToWorldTile` already takes `tileSize` as a parameter, so the existing call site must read the live tileSize at click time (not capture it). Easy regression to introduce.

## Out of scope (revisit later)

- Smoothing-disable accessibility toggle (some users prefer instant follow).
- Camera shake intensity slider.
- Bigger zoom range (16px and 56px tested; outside that range minimap scaling and HUD readability degrade).
- Replacing `TILE_SIZE` in tests/fixtures — they don't render so it's fine to leave the literal there.
