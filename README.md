# Skull Empires Revived

Browser-based, director-style roguelike. Phase 1A ships the playable core (one floor, one enemy archetype, win/lose, deterministic replay).

## Develop

Requires Bun 1.1+.

```
bun install
bun x vite
```

Open http://localhost:5173/?dev=1.

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

## Phase 1B — Polish pass

1B adds a visual + audio layer over the 1A core. The core state machine is unchanged; all new work is downstream:

- Two canvases: `#world` (existing) and `#fx` (new, always RAF). A small shake offset is applied to both.
- `render/display.ts` maintains ephemeral interpolated actor positions (slide tween on move, attack lunge + recoil).
- `render/fx/bus.ts` is a typed event queue; the dispatch wrapper publishes diffs. Subscribers: `render/fx/presets.ts` (visual) + `audio/subscribe.ts` (SFX).
- `render/shape.ts` draws per-archetype procedural silhouettes from `archetypes.json` recipes.
- Dark-fantasy palette in `content/palette.ts` — no inline hex.

**Audio:** 5 CC0 clips in `public/audio/` (sourcing guide in that folder's README). Game is silent-but-playable if files absent.

**Font:** UnifrakturMaguntia via Google Fonts runtime `<link>`.
