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
