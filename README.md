# Skull Empires Revived

Browser-based, director-style roguelike. Five floors, cards, a throne-room boss, deterministic replay, and auto-resume after refresh.

## Develop

Requires Bun 1.1+.

```
bun install
bun run dev
```

Open http://localhost:5173/?dev=1.

## Test

```
bun test
bun run typecheck
```

## Controls

- **Left-click** a floor tile — hero auto-paths there.
- **Left-click** an enemy — hero paths adjacent and attacks.
- **Descend ↓** button (HUD) — appears when standing on a stairs tile; advances a floor.
- **Card buttons** (bottom-center) — click to play; enemy-target cards enter targeting mode, then click an enemy.
- **Card reward modal** — appears between floors; pick one to add to your deck.
- **R** — new run (fresh seed).
- **Backtick (`` ` ``)** — toggle dev menu.
- **Share URL** — end-of-run overlay, copies a replay URL.

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

## Phase 1C — Multi-floor, cards, boss, persistence

Spec: `docs/plans/2026-04-17-phase-1c-design.md`. Plan: `docs/plans/2026-04-17-phase-1c-plan.md`.

- **Camera** — `render/camera.ts` centers the viewport on the hero; mouse clicks are mapped back through the same offset.
- **Multi-floor** — `Tile.Stairs`, `Descend` action, 5 floors per run.
- **Boss floor** (depth 5) — throne-room layout, one Skull Emperor + two bone-knight escorts. Reach it by descending from floor 4; kill-all ends the run.
- **Cards** — 6 starter cards (`Blessing`, `Heal`, `Guard`, `Smite`, `Curse`, `Storm`). Start with 3 in hand. Kill-all on non-boss floors offers a 3-card reward; pick one to add to your deck.
- **Status effects** — `buff-atk` / `buff-def` / `debuff-def` modify attack/defense math; tick down on each `TurnAdvance` and purge at zero.
- **Persistence** — SQLite-WASM in a Web Worker, backed by OPFS. Auto-resumes an in-progress run on boot (URL param overrides DB). Requires cross-origin isolation headers (set in `vite.config.ts`).
- **Dev menu** (backtick) — volume slider, `slowMotion`, `pauseEnemies`, `invincibleHero`, `showFps`, `showHeroPath`. `revealMap` exists for future fog-of-war work.
