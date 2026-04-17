# Skull Empires Revived — Phase 1B (Polish Pass) Design

**Date:** 2026-04-17
**Owner:** kashik0i
**Status:** Approved for planning
**Supersedes sequencing:** original 1B (cards/multi-floor) → renamed 1C. This polish pass takes the 1B slot.

## 1. Goal

Stop the game from looking like Snake. Same gameplay as 1A (one floor, one enemy type, hero with click-to-move/attack), but with motion that feels good and art that looks deliberate. No new gameplay systems. No new content (except shape recipes for existing actors).

Win criterion: a screen recording of a 30-second run looks recognisably like a dark-fantasy roguelike, not a geometry demo.

## 2. Scope locked

**In:**
- Smooth movement (tween slide between tiles, 150ms ease-out-cubic)
- Attack lunge + recoil (80ms each way, no state change, purely visual)
- Death fade-scale + skull-white particle spew
- Hit flash (brief white overlay on damaged actor, 120ms fade)
- Floating damage numbers (red text, rises + fades over 600ms)
- Screen shake on hero damage (3px amplitude, 100ms)
- Card-play flash preset (wired now, triggered by card action in 1C)
- Per-archetype procedural shape recipes (silhouette body + accent strip + head dot, all Canvas 2D primitives)
- Dark-fantasy palette (8 colors, applied everywhere)
- Self-hosted UnifrakturMaguntia font for HUD + overlay
- Minimal SFX (5 clips: step, hit, death, attack, generic-click for future card play)
- Chrome DevTools MCP runtime verification harness

**Out (deferred):**
- SQLite / persistence / auto-resume → 1C
- Multi-floor / stairs / boss → 1C
- Cards / deck / hand → 1C
- Gestures / voice / calibration → 1D
- Dialog / NPC archetypes → 1E
- Music, ambient audio, audio mixer → post-Phase 1
- New enemy archetypes → 1E (1B polishes what's already there)

## 3. Architecture

Two new canvases stacked in the page. Core state is untouched — the polish layer is strictly downstream.

```
┌──────────────────────────────────────────────────────────┐
│                    index.html                            │
│                                                          │
│   #world canvas  ← tiles + actors (uses displayX/Y)      │
│   #fx canvas     ← particles, flashes, damage numbers    │
│   #hud overlay   ← HP, log, run-end (textContent only)   │
└──────────────────────────────────────────────────────────┘
            ▲                     ▲
            │                     │
     drawWorld(ctx, state,        fxCanvas RAF loop
                displayState)      ← consumes fx bus events
            ▲                     ▲
            │                     │
    displayState.tick(dt)     fxBus.publish(...)
    (reads state, manages          ▲
     tween progress per actor)     │
            ▲                      │
            └────── game loop ─────┘
                        │
                 dispatch(state, action)
                    wraps core dispatch
                    — calls rootReducer
                    — appends to log (unchanged)
                    — diffs state' vs state
                    — publishes events to fxBus
                        │
                        ▼
                 pure core (unchanged)
```

**Separation of concerns:**
- **Core (unchanged):** reducers, rng, log, state shape. Pure TS. No awareness of FX.
- **Dispatch wrapper (new):** wraps existing `dispatch`. Same signature. Inside: runs the core dispatch, then diffs (state, state') and publishes typed events to the FX bus. Core stays replaceable.
- **Display state (new):** ephemeral `Map<ActorId, DisplayActor>` kept in memory only. Interpolates `state.actors[id].pos` toward the display pos over 150ms per move. Rendered via world canvas. Discarded on page reload (replay still deterministic because core is the source of truth).
- **FX bus (new):** typed event queue + subscribe. Events: `moved`, `attacked`, `damaged`, `died`, `run-ended`, `card-played` (wired, triggered by 1C). Each subscriber is a preset.
- **Presets (new):** named FX responses. A preset reads an event and spawns particle emitters / flash overlays / damage-number floats / screen-shake impulses on the FX canvas.
- **Audio (new):** subscriber on the FX bus. Maps event kinds to SFX clips. Pooled `HTMLAudioElement` (3 instances per clip for concurrency). Silent fallback if clip load fails.
- **Shape recipes (new):** per-archetype JSON blob (body geometry + accent + head + palette slot). Renderer walks the recipe and draws stacked Canvas 2D primitives. No sprite sheets.

## 4. Data — display state + events

**`DisplayActor`** (ephemeral, one per live actor):
```ts
type DisplayActor = {
  id: ActorId
  x: number; y: number                 // current display (tile units, float)
  tx: number; ty: number               // tween target
  tweenT: number; tweenDuration: number // 0..1, ms
  ease: 'out-cubic' | 'in-out-quad'
  // attack-specific:
  lungeOrigin: { x: number; y: number } | null
  lungeTarget: { x: number; y: number } | null
}
```

**FX event types:**
```ts
type FxEvent =
  | { kind: 'moved'; actorId: ActorId; from: Pos; to: Pos }
  | { kind: 'attacked'; attackerId: ActorId; targetId: ActorId; attackerPos: Pos; targetPos: Pos }
  | { kind: 'damaged'; targetId: ActorId; amount: number; pos: Pos; isHero: boolean }
  | { kind: 'died'; actorId: ActorId; pos: Pos; archetype: string }
  | { kind: 'run-ended'; outcome: 'won' | 'lost' }
  | { kind: 'card-played'; cardId: string; targetPos?: Pos } // reserved for 1C
```

Events are pushed to a queue on dispatch. Each RAF frame, FX subsystem drains the queue into preset handlers.

## 5. Components (new modules, each ~50-150 LOC)

| Module | Responsibility | Parallel-safe? |
|---|---|---|
| `render/display.ts` | DisplayState: create, tick(dt), getDisplayPos(id), reconcile with state changes | yes (pure fn + small class) |
| `render/shape.ts` | `drawShape(ctx, recipe, x, y, palette)` — procedural actor renderer | yes |
| `render/world.ts` | (refactor) consume DisplayState + shape recipes instead of drawing circles | depends on display + shape |
| `render/fx/bus.ts` | Event queue + subscribe + publish | yes (standalone) |
| `render/fx/canvas.ts` | Second canvas bootstrap + `tickFx(dt, state, displayState)` called from the main RAF loop; drains bus + dispatches to presets + draws particles & flashes | depends on bus |
| `render/fx/tweens.ts` | `ease()` functions + `lerp()` + tween manager (for non-movement tweens like damage-number rise) | yes |
| `render/fx/particles.ts` | Pool (cap 500) + emitter preset spec + update/draw | yes |
| `render/fx/presets.ts` | Named responses to events: `hitFlash`, `deathSpew`, `attackLunge`, `damageFloat`, `cardPlay`, `screenShake` | depends on particles + tweens |
| `audio/sfx.ts` | HTMLAudioElement pool, load on init, `play(clipId)` | yes |
| `audio/subscribe.ts` | Subscribes to fx bus, maps event kinds to `sfx.play()` | depends on bus + sfx |
| `content/palette.ts` | Named color constants (bone-white, deep-purple, blood-crimson, silk-flame-amber, obsidian-black, iron-gray, ghost-teal, rune-violet) | yes |
| `content/archetypes.json` | (extend) add `shape` recipe per archetype | yes |
| `core/dispatch.ts` | (wrap, not replace) publish diff events alongside log append | depends on bus + core/types |

**~12 new files + 2 refactors + 5 sfx clips + 1 font file.**

## 6. Palette (locked)

```ts
export const palette = {
  boneWhite:       '#eadbc0',  // hero primary, skull particles
  deepPurple:      '#2a1a3e',  // tile wall
  deepPurpleDark:  '#1a1024',  // outer void
  deepPurpleLite:  '#3e2a5c',  // tile floor, hover highlight
  bloodCrimson:    '#7a1f2e',  // damage numbers, hero hurt flash
  silkFlameAmber:  '#f0b770',  // card-play, crits, key callouts
  obsidianBlack:   '#0b0612',  // background, deep shadow
  ironGray:        '#706078',  // corpse tint after death fade
  ghostTeal:       '#4a8a8a',  // whisper/interaction (wired for 1C/1D)
  runeViolet:      '#b7a3d9',  // bone-knight primary, generic enemy
} as const
```

All actor colors, particle tints, flash overlays, HUD borders pull from this. No inline hex outside `palette.ts`.

## 7. Shape recipes (locked format)

Per archetype in `archetypes.json`:

```json
"bone-knight": {
  "kind": "enemy", "name": "Bone Knight", "hp": 8, "atk": 3, "def": 0,
  "behavior": "chase",
  "shape": {
    "body":   { "type": "rect", "w": 0.55, "h": 0.75, "color": "runeViolet", "corner": 0.1 },
    "accent": { "type": "strip", "y": 0.35, "h": 0.08, "color": "silkFlameAmber" },
    "head":   { "type": "circle", "y": -0.4, "r": 0.22, "color": "boneWhite" },
    "eyes":   { "type": "eyeDots", "y": -0.42, "spacing": 0.1, "r": 0.03, "color": "obsidianBlack" }
  }
},
"hero": {
  ...,
  "shape": {
    "body":   { "type": "rect", "w": 0.5, "h": 0.7, "color": "boneWhite", "corner": 0.2 },
    "accent": { "type": "strip", "y": 0.3, "h": 0.06, "color": "bloodCrimson" },
    "head":   { "type": "circle", "y": -0.38, "r": 0.2, "color": "boneWhite" },
    "eyes":   { "type": "eyeDots", "y": -0.4, "spacing": 0.09, "r": 0.03, "color": "deepPurpleDark" }
  }
}
```

Coordinates are fractions of tile size (24px) centered on the tile. Color names resolve via `palette`. The recipe is declarative — any future archetype is a new JSON entry, no code change.

`drawShape()` walks `body → accent → head → eyes` in z-order.

## 8. FX presets (locked behaviors)

| Preset | Trigger | Behavior |
|---|---|---|
| **attackLunge** | `attacked` | Sets attacker's DisplayActor into lunge mode: 80ms toward `targetPos` (overshoot 30% past the midpoint), 80ms recoil. Actor state pos unchanged. |
| **hitFlash** | `damaged` | Bone-white overlay on target actor's shape: tint + fade over 120ms. Drawn on FX canvas at event `pos` (glued to hit location, not to the actor's later tween). |
| **damageFloat** | `damaged` | Spawns a text tween on FX canvas: red number rises 18px over 600ms, fades 0 → 1 → 0 alpha. Font: UnifrakturMaguntia bold 14px. |
| **deathSpew** | `died` | Spawns 12 particles at actor pos, boneWhite + ironGray mix, radial outward velocity, 700ms life with gravity+fade. Removes actor display entry. |
| **screenShake** | `damaged` where `isHero === true` | Offsets both canvases by `sin(t * freq) * amplitude` for 100ms. Amplitude 3px, freq 40Hz. |
| **cardPlay** | `card-played` (1C) | Silk-flame amber radial wash over screen, 200ms, plus 20-particle spark at targetPos if provided. Wired now, idle until 1C triggers it. |

Particles are hand-rolled: simple struct, pool of 500 recycled slots, no allocation in hot path.

## 9. Audio

5 clips in `public/audio/` (self-hosted, not CDN):

| Clip | Trigger event | Max concurrent |
|---|---|---|
| `step.mp3` | `moved` where actor is hero | 1 (last wins) |
| `hit.mp3` | `damaged` | 3 |
| `death.mp3` | `died` | 2 |
| `attack.mp3` | `attacked` | 3 |
| `click.mp3` | `card-played` (1C) | 1 |

**Loading:** `new Audio('/audio/hit.mp3')` per clip × pool size, preloaded on init. If any clip 404s, `audio/sfx.ts` logs a warning and that clip becomes a silent no-op (game still works).

**Volume:** global 0.5 default, no UI control in 1B (add in 1E with settings).

**Source:** user sources clips from freesound.org or similar royalty-free (LICENSE.md lists attributions). The plan will specify the exact clips / URLs when implementation lands.

## 10. Performance budget

| Budget | Target | Measurement |
|---|---|---|
| World redraw | ≤2ms mid-range laptop | chrome-devtools `performance_start_trace` during a frame-heavy moment |
| FX redraw | ≤5ms with 200 alive particles | same |
| Frame rate | 60fps sustained during a busy combat moment | Chrome DevTools FPS meter |
| Bundle size | ≤50KB gzip (font not counted; font loads async) | `bun x vite build` output |
| Initial load | font optional (FOUT acceptable — system serif fallback) | Lighthouse LCP |

Particle pool capped at 500 alive. Recycled, no GC pressure. If emitters request more than pool can provide, oldest particles get recycled (graceful degradation).

## 11. Testing

**Unit (Bun test, deterministic):**
- `render/display.test.ts` — given state and dt, DisplayActor pos advances correctly
- `render/fx/bus.test.ts` — publish/subscribe, queue drain order
- `render/fx/tweens.test.ts` — ease functions, lerp edges
- `render/fx/particles.test.ts` — pool overflow behavior, particle lifecycle
- `render/shape.test.ts` — recipe parsing (validator only; no canvas mocking)

**Runtime (Chrome DevTools MCP):**
- Boot game, wait for `#world` canvas render
- Script-click an adjacent tile → screenshot before/after, verify pixel delta in tile region
- Wait 150ms, verify actor has moved to new tile
- Script-click enemy → verify hit flash + damage number appear (pixel check in target region)
- Wait for death → verify particles present + actor removed
- FPS stays ≥55 throughout (Performance trace)

Chrome DevTools MCP is used both for dev-loop verification (during implementation) and as an automated smoke test checked into the plan.

**Not tested:**
- SFX playback (browsers block audio without user gesture; manual verification only)
- Font rendering (visual-only check)
- Particle motion fidelity (visual-only, would require pixel snapshots which are brittle)

## 12. Error handling

- **Font fails to load** → FOUT, system serif fallback. No blocker.
- **SFX clip fails to load** → clip becomes silent no-op. Warn once. No blocker.
- **FX canvas context unavailable** (corner case) → world canvas still runs, game playable without polish. Warn once.
- **Particle pool exhausted** → recycle oldest. Not an error.
- **Shape recipe malformed** → warn, fall back to 1A-style colored circle for that archetype. Game playable.
- **Tween duration zero or negative** → snap display to state instantly, no tween. Not an error.

No errors propagate to the core. No errors block gameplay.

## 13. Parallelization plan (for execution)

Three wave-shaped execution, safe for parallel subagent dispatch within a wave:

**Wave 1 — foundations (all parallel):**
- palette.ts
- fx/bus.ts
- fx/tweens.ts
- fx/particles.ts
- render/display.ts
- render/shape.ts
- audio/sfx.ts
- Add shape recipes to archetypes.json

**Wave 2 — integration (all parallel after Wave 1):**
- fx/canvas.ts (depends on bus, tweens, particles)
- fx/presets.ts (depends on particles, tweens)
- audio/subscribe.ts (depends on bus, sfx)
- core/dispatch.ts wrap (depends on bus)
- render/world.ts refactor (depends on display, shape)

**Wave 3 — serial (one at a time):**
- Wire everything in main.ts
- Load font in index.html
- Chrome DevTools MCP runtime smoke test authored + green
- Commit + final verification

The plan task-list will mark each task `wave: 1|2|3` so the executor (subagent-driven-development) can dispatch Wave 1 subagents in parallel, then Wave 2, then Wave 3 serially.

## 14. Success criteria (done-when)

- `bun test` passes (existing 43 + new ~15 = ~58)
- `bun x tsc --noEmit` clean
- `bun x vite build` ≤50KB gzip bundle
- Chrome DevTools MCP runtime smoke test passes
- Manual browser playtest: hero slides smoothly, attacks lunge, enemy dies with particle burst, HUD uses the font, palette feels coherent, screen shakes when hero takes a hit
- No regression in 1A behavior: replay from saved action-log URL still reconstructs identical state

## 15. Open questions for planning phase

None of the following block the spec. They're planning-phase details.

- Exact SFX clips (freesound URLs + license notes)
- Exact tween durations (may need live-tuning — spec lists starting values)
- Whether to ship a `?perf=1` debug overlay showing FPS + particle count (nice to have, probably yes, lightweight)
- Whether the first run should show a one-time "click to start" gesture gate so audio context unlocks cleanly (yes, minimal — a transparent click-to-dismiss splash)

---

**This spec is minimal on purpose.** Everything it doesn't lock is a planning-phase detail. The plan will name files, exact function signatures, exact test assertions, and the wave-by-wave task list with commit points.
