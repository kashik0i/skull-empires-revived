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

## Phase 1D — Narrative & content

Spec: `docs/plans/2026-04-18-phase-1d-design.md`.
Plan: `docs/plans/2026-04-18-phase-1d-plan.md`.

- **NPC — Grim the Wanderer.** Merchant appears on floors 2 and 4 near
  hero spawn. Click to approach; adjacency opens a 3-card trade modal.
  Hero swaps positions with NPCs when walking onto their tile (no hard
  blocking), so a merchant never strands the hero.
- **Lore scrolls.** One per non-boss floor, placed on a random floor tile.
  Step onto it to read a fragment; no codex — read once, gone.
- **Shrines.** ~25% of non-boss floors have a shrine tile. Stand on it
  to choose Blood (+2 maxHp) or Breath (+1 atk). The tile converts back
  to floor after resolving.
- **3 new cards:** Greater Heal (heal 12), Fortify (+2 DEF / 6 ticks),
  Vigor (+3 ATK / 3 ticks).

Dialog UX: any NPC / scroll / shrine interaction opens a centered modal.
Card hand and other UI remain visible but non-interactive while the
modal is up.

Control note: player intent (click-to-move / click-to-attack / click-NPC)
takes precedence over auto-defend, so you can retreat from or walk past
adjacent enemies when you want to.

### Phase 1D smoke checklist

1. Fresh run — floor 1 has exactly one lore scroll placed on a floor tile;
   walk onto it → lore modal, dismiss → continue.
2. Kill all enemies on floor 1 → card reward modal (unchanged).
3. Descend to floor 2 → merchant appears near hero spawn. Click merchant
   from any distance → hero walks toward merchant (passing through other
   NPCs / swapping with adjacent NPCs). Adjacent → modal with 3 cards.
   Pick one → card added to deck; merchant vanishes.
4. Some non-boss floors have a shrine; walk onto it → modal → pick Blood
   or Breath → HUD stat updates visibly. Tile becomes floor.
5. Click to retreat while an enemy is adjacent → hero walks away instead
   of auto-attacking.
6. Refresh mid-run → auto-resume preserves scrolls / shrines / merchant
   state and any completed stat changes.
7. Boss floor (5) — no merchant, no scroll, no shrine. Win condition
   unchanged.
