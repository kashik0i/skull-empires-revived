# Skull Empires Revived — Phase 1C Design

**Date:** 2026-04-17
**Owner:** kashik0i
**Status:** Approved for planning
**Depends on:** Phase 1A (playable core) + 1B (polish pass) shipped

## 1. Goal

Turn the one-floor demo into a proper roguelike run: **5 floors, a boss, cards that shape tactics, persistence across refreshes**. Fix known friction: fixed-size canvas (→ camera), dumb enemies (→ BFS chase), silent state (→ SQLite debug store).

**Done-when:** a player can enter the game fresh, descend through 5 floors using stairs, play cards between floors, kill the Skull Emperor on floor 5, see the win screen — and if they refresh mid-run, resume exactly where they left off.

## 2. Scope in

- **Camera** — viewport follows hero, scrolls when the floor exceeds the canvas
- **Multi-floor** — 5 procgen floors per run, seed = `run-seed + depth`, descending via stairs
- **Stairs feature + `Descend` action** — generates next floor, swaps state's `floor`, re-seats actors
- **Cards** — `hand: CardId[]`, `deck: CardId[]`, `discard: CardId[]`, `PlayCard` action, between-floor pick-1-of-3 reward
- **Card content** — 6 starter cards: `bless` (+atk for hero), `heal` (restore hp), `storm` (damage all enemies on floor), `reveal-map` (fog off for one floor), `curse` (-def on target), `smite` (big single-target damage)
- **Boss** — Skull Emperor archetype on floor 5 (unique shape, 60hp, 8atk, 2def, chase behavior)
- **Smart enemies** — replace greedy-hill-climb chase with BFS pathfinding (reuses `src/ai/pathfind.ts`)
- **SQLite persistence** — `@sqlite.org/sqlite-wasm` in a worker, OPFS-backed when available. Auto-save action log + run metadata. Auto-resume last un-ended run on page refresh.
- **Dev menu flags** — add `pauseEnemies`, `invincibleHero`, `revealMap`, `volume` (0-1 slider)

## 3. Scope out (explicitly deferred)

- Items / equipment → 1D
- Dialog / NPCs → 1E
- Gestures / voice input → 1D
- LLM-driven AI → Phase 2
- Multiplayer → Phase 3
- Audio mixer, music → post-Phase 1
- Multiple save slots → 1E (single auto-resume slot for now)

## 4. Architecture

### What stays the same
- Pure-TS core: types, reducers, RNG, dispatch pipeline
- FX bus + display state + shape recipes
- Turn-based loop, 300ms enemy tick (or slow-mo from dev flag)
- Share-URL encoding

### What changes
- `World.floor` → remains a single floor, but `World.run` gains `{ depth: number; cardDeck; cardHand; cardDiscard }`
- Stairs tile type (new `Tile.Stairs = 3`)
- New `Descend` action: consumes stairs, seeds floor N+1, re-places hero + enemies, clears heroPath
- New `PlayCard` action: pops from hand, applies effect, pushes to discard
- New `OfferCardReward` + `PickCardReward` actions for between-floor flow
- `World.phase` gains `'card_reward'` (after clearing floor, before descent)
- Camera: render computes a viewport offset centered on hero, clamped to floor bounds
- Enemies call `firstStepToward(state, enemy.pos, hero.pos)` instead of the greedy step
- SQLite runs in a Web Worker; main thread posts `{seed, action}` events; worker writes; main thread queries on boot for auto-resume
- On boot: if SQLite has an un-ended run, replay its log. If URL has `?run=`, it wins over DB. If URL has `?seed=`, start fresh with that seed.

### New module layout
```
src/
  core/
    types.ts           # +Tile.Stairs, +Card types, +HeroRun fields, +new actions
    state.ts           # initialize first floor's deck (starter)
    reducers/
      descend.ts       # new
      card.ts          # new — PlayCard + OfferCardReward + PickCardReward
  procgen/
    floor.ts           # +stairs placement on a random room
    boss.ts            # new — boss-only floor variant (floor 5)
  content/
    cards.json         # new — 6 starter cards + effects
    cardLoader.ts      # new
  ai/
    pathfind.ts        # unchanged
    behaviors/
      chase.ts         # upgrade to BFS chase
  render/
    camera.ts          # new — computes pan offset + clipping
    world.ts           # consume camera offset
    ui/
      cardHand.ts      # new — renders hand at bottom of screen
      cardReward.ts    # new — modal pick-1-of-3 overlay
  persistence/
    db/
      worker.ts        # new — SQLite WASM worker (init OPFS DB, schema, upsert run, append events)
      client.ts        # new — main-thread message API to the worker
      schema.sql       # new — runs, events, snapshots tables
    autoResume.ts      # new — on boot, check for resumable run and hydrate
  dev/
    flags.ts           # +pauseEnemies, +invincibleHero, +revealMap, +volume
  ui/
    devMenu.ts         # add volume slider + new checkboxes
    hud.ts             # show depth counter
```

## 5. Camera system

**Design:** render-layer computes a camera offset each frame. Offset centers the hero's display position in the viewport, clamped so floors smaller than the viewport stay at the origin.

```
offsetX = clamp(heroDisplayX * tileSize - viewportW / 2, 0, floorW * tileSize - viewportW)
offsetY = clamp(heroDisplayY * tileSize - viewportH / 2, 0, floorH * tileSize - viewportH)
```

`renderWorld` translates the context by `-offsetX, -offsetY` before drawing tiles. Actors + hero path dots get the same translation. FX canvas also receives the same offset (particles, damage numbers, flashes all render in world space).

**Floor sizes:**
- Floors 1-4: 40×30 tiles (same as 1A/1B) — fits viewport, camera is a no-op
- Floor 5 (boss): 50×40 tiles — viewport scrolls

Click-to-tile conversion in `dev.ts` needs to subtract the camera offset too.

**Tests:** camera offset math is pure, unit-testable.

## 6. Multi-floor model

### World changes
```ts
type World = {
  ...
  run: {
    depth: number        // 1..5
    cards: { hand: CardId[]; deck: CardId[]; discard: CardId[] }
    pendingReward: CardId[] | null  // 3 options offered after clearing floor
  }
  // existing fields stay
}
```

### Flow
1. Game starts: `world.run.depth = 1`, deck populated with starter cards (`bless, heal, storm, reveal-map, curse, smite`), hand drawn to 3.
2. Floor generated from `seed + depth`. Stairs placed in a random non-spawn room.
3. Player explores, fights, steps on stairs → `Descend` action enabled (or auto-fires on reach).
4. On `Descend`: if `depth < 5`, enter `card_reward` phase with 3 random deck-style offerings. Player picks one → `PickCardReward` → adds to deck, redraws hand, `Descend` to next floor. If `depth === 5`, advance to boss floor directly (no reward because boss is next).
5. On floor 5 (boss floor): no stairs, single boss spawns + 2 bone-knights. Kill boss → `run_won`.
6. Hero death any time → `run_lost`.

### Descend action
```ts
{ type: 'Descend' }
```
- Increments `run.depth`
- Generates new floor via `generateFloor(rng, W, H)` or `generateBossFloor(rng)` for depth === 5
- Places hero at new floor's spawn[0], carries over hp (no full heal)
- Spawns enemies at spawns[1..]
- Clears `heroIntent`, `heroPath`
- Resets `turnOrder`, `turnIndex`
- Tick continues

## 7. Stairs + tile changes

`Tile.Stairs = 3` added to tile kinds. Rendered as a distinct tile color (amber accent). `Descend` action only valid if hero is on a stairs tile.

Stairs are placed during floor generation in a random room's center (excluding the hero's spawn room). One stairs per floor, no stairs on floor 5 (boss).

## 8. Cards

### Card definition (JSON)
```json
{
  "bless":       { "name": "Blessing",  "cost": 0, "target": "self",    "fx": "cardPlay", "effect": { "kind": "buff-atk", "amount": 2, "durationTicks": 30 } },
  "heal":        { "name": "Heal",      "cost": 0, "target": "self",    "fx": "cardPlay", "effect": { "kind": "heal", "amount": 8 } },
  "storm":       { "name": "Storm",     "cost": 0, "target": "none",    "fx": "cardPlay", "effect": { "kind": "aoe-damage", "amount": 4 } },
  "reveal-map":  { "name": "Reveal",    "cost": 0, "target": "none",    "fx": "cardPlay", "effect": { "kind": "reveal" } },
  "curse":       { "name": "Curse",     "cost": 0, "target": "enemy",   "fx": "cardPlay", "effect": { "kind": "debuff-def", "amount": 1, "durationTicks": 20 } },
  "smite":       { "name": "Smite",     "cost": 0, "target": "enemy",   "fx": "cardPlay", "effect": { "kind": "direct-damage", "amount": 12 } }
}
```

Cost ignored in 1C (all 0). Reserved for 1D mana system.

### Actions
```ts
{ type: 'PlayCard'; cardId: string; targetId?: ActorId }
{ type: 'OfferCardReward'; options: CardId[] }
{ type: 'PickCardReward'; cardId: CardId }
```

### Play flow
- Cards in hand rendered as buttons at bottom of screen
- Click card → if target required, cursor enters target-select mode, click target → PlayCard(card, target)
- If target === self or none, click card twice to confirm (simple UX, can improve later)
- Card resolves via effect handler; emits a `card-played` FX bus event (presets render flash + sound)
- Discarded to pile. Hand refills to 3 at end of next turn.

### Buffs / debuffs in 1C
Simple: add `statusEffects: StatusEffect[]` to Actor. Each has `kind`, `amount`, `remainingTicks`. Decremented on each TurnAdvance. Applied to atk/def calc in reducers.

```ts
type StatusEffect =
  | { kind: 'buff-atk'; amount: number; remainingTicks: number }
  | { kind: 'debuff-def'; amount: number; remainingTicks: number }
```

### Between-floor reward
When hero reaches stairs + advances (or optionally right on stepping on stairs), phase → `card_reward`. 3 random card IDs offered from the full pool. Player picks one. Deck grows.

### Starter deck
Generated in `createInitialWorld`: `['bless', 'heal', 'storm', 'reveal-map', 'curse', 'smite']` shuffled, hand 3 drawn. Future phases can replace this with a smaller starter and earn cards via rewards.

## 9. Boss

```json
"skull-emperor": {
  "kind": "enemy",
  "name": "Skull Emperor",
  "hp": 60,
  "atk": 8,
  "def": 2,
  "color": "bloodCrimson",
  "behavior": "chase",
  "shape": {
    "body":   { "type": "rect", "w": 0.75, "h": 0.9, "color": "bloodCrimson", "corner": 0.08 },
    "accent": { "type": "strip", "y": 0.25, "h": 0.12, "color": "silkFlameAmber" },
    "head":   { "type": "circle", "y": -0.45, "r": 0.3, "color": "boneWhite" },
    "eyes":   { "type": "eyeDots", "y": -0.48, "spacing": 0.15, "r": 0.04, "color": "bloodCrimson" }
  }
}
```

Generated on floor 5. Spawn count: 1 boss + 2 bone-knights as escort.

## 10. Smart enemies

Replace the greedy-hill-climb in `src/ai/behaviors/chase.ts`:

```ts
export function chaseHero(state, actorId): Action {
  const actor = state.actors[actorId]
  const hero = state.actors[state.heroId]
  if (!actor || !actor.alive || !hero || !hero.alive) return { type: 'TurnAdvance' }
  if (manhattan(actor.pos, hero.pos) === 1) {
    return { type: 'AttackActor', attackerId: actorId, targetId: state.heroId }
  }
  const path = firstStepToward(state, actor.pos, hero.pos, { passThroughActors: [hero.id] })
  return path ? { type: 'MoveActor', actorId, to: path } : { type: 'TurnAdvance' }
}
```

Same tool the hero uses. Enemies now route around walls and other enemies.

**Tests:** the existing sideways-probe regression test should still pass (BFS handles the case trivially).

## 11. SQLite persistence

### Stack
- `@sqlite.org/sqlite-wasm` (official WASM build)
- Runs in a Web Worker to keep rendering off the main thread
- OPFS (Origin Private File System) as the backing store when available
- Fallback: in-memory mode if OPFS is unavailable (Safari on older iOS, etc.) — runs are lost on reload but the game still works

### Schema (`schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,            -- uuid per run
  seed TEXT NOT NULL,
  started_at INTEGER NOT NULL,    -- unix ms
  ended_at INTEGER,               -- null while in progress
  outcome TEXT,                   -- 'won' | 'lost' | null
  final_tick INTEGER
);

CREATE TABLE IF NOT EXISTS events (
  run_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  tick INTEGER NOT NULL,
  action_json TEXT NOT NULL,
  PRIMARY KEY (run_id, idx),
  FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_events_run ON events (run_id);
```

### Worker API
The main thread posts messages; the worker processes them and returns responses.

```ts
// client.ts exposes:
dbClient.startRun(runId, seed): Promise<void>
dbClient.appendEvent(runId, idx, tick, action): Promise<void>  // batched — sends every N or on idle
dbClient.endRun(runId, outcome, finalTick): Promise<void>
dbClient.getLatestUnended(): Promise<{ runId, seed, events: Action[] } | null>
dbClient.deleteRun(runId): Promise<void>
```

### Write cadence
- Client batches events in a 50ms-debounced buffer
- Uses `requestIdleCallback` if available, else `setTimeout`
- Flush on page `beforeunload`

### Auto-resume
On boot:
1. Check URL. If `?run=` present → decode + replay (existing path). Skip DB.
2. Else check DB. `getLatestUnended()` returns any run where `ended_at IS NULL`.
   - If found and the action log non-empty → replay it, initialize display state, resume.
   - If found but log empty → delete it (aborted init), start fresh.
3. Else start fresh with a new runId.

New run: generate a uuid-like ID (crypto.randomUUID if available), `startRun(runId, seed)`.

Each dispatched action → `appendEvent(runId, logLength, state.tick, action)`.

On `RunEnd` action → `endRun(runId, outcome, state.tick)`. That run no longer qualifies for auto-resume.

### Storage size
Budget: actions per run ≈ 500-2000, each ~100 bytes JSON → ~200KB per run. Retention: keep last 10 runs, prune oldest on boot if DB > 2MB.

## 12. Dev menu flag additions

| Flag | Effect |
|---|---|
| `pauseEnemies` | Loop skips enemy ticks entirely |
| `invincibleHero` | AttackActor reducer caps hero damage at hp-1 (never kills) |
| `revealMap` | (existing fog-of-war deferred; treat as no-op for 1C) — wired for 1D |
| `volume` | Slider 0.0–1.0, passed through to Web Audio gain multiplier |

Slider UI in dev menu: simple `<input type="range">` that calls `flags.set('volume', value)`.

## 13. Performance

- BFS chase is O(W*H) per enemy per turn. On 40×30 floor with 4 enemies, that's ~5000 ops per 300ms tick. Trivial.
- SQLite worker: no blocking on main thread. Writes batched, amortized ~1ms every 50ms.
- Camera: pure function, ~5 arithmetic ops per frame.
- Overall: 60fps target preserved.

## 14. Testing

**Unit (Bun test):**
- `core/reducers/descend.test.ts` — floor swaps, depth increments, actors repositioned
- `core/reducers/card.test.ts` — PlayCard consumes hand, applies effect, discards; OfferCardReward + PickCardReward
- `procgen/floor.test.ts` — stairs placed on floor tile, not on spawn tile, not on floor 5
- `procgen/boss.test.ts` — boss floor generates boss + 2 escorts
- `ai/behaviors/chase.test.ts` — BFS-chase returns valid step
- `render/camera.test.ts` — offset clamped correctly, scrolls with hero
- `persistence/db/client.test.ts` — batch behavior, message protocol (with mocked worker)
- `persistence/autoResume.test.ts` — boot logic: URL > DB > fresh
- `dev/flags.test.ts` — add cases for new flags + volume

**Runtime smoke (manual, per 1B feedback no MCP):**
- Checklist in README for user to follow

## 15. Ship criterion

- `bun test` green, ~130 tests
- `bun x tsc --noEmit` clean
- `bun run build` clean, bundle ≤ 150KB gzip (SQLite WASM is ~1MB but loaded lazily in worker)
- Manual: descend 5 floors, play 2+ cards, kill boss, see win overlay
- Manual: refresh mid-floor 3 — resume to floor 3 with same HP, same deck, same turn

## 16. Implementation waves (for plan phase)

1. **Wave 1 — primitives (all parallel):**
   - Tile.Stairs + stairs placement in floor.ts
   - Camera module (pure)
   - Dev flags expansion
   - Card JSON + loader
   - StatusEffect types + decrement in turn reducer
2. **Wave 2 — gameplay actions (parallel):**
   - Descend action + reducer
   - PlayCard / OfferCardReward / PickCardReward actions + reducers
   - BFS chase (replace greedy)
   - Boss archetype + generator
3. **Wave 3 — UI (parallel):**
   - Card hand DOM
   - Card reward modal
   - HUD depth counter
   - Dev menu slider + new checkboxes
4. **Wave 4 — persistence (serial):**
   - DB worker (SQLite init + schema + message handlers)
   - Client wrapper + batched writer
   - Auto-resume on boot
   - Wire into dispatch pipeline
5. **Wave 5 — integration & polish (serial):**
   - main.ts wiring, loop passes camera offset, input converts screen→world
   - Manual smoke checklist + final verification

## 17. Open questions for planning phase

- Between-floor flow: stairs trigger reward automatically, or require explicit Descend click? → **auto-trigger on step-on-stairs**
- Target-select UX for cards that need an enemy: cursor change vs dedicated click-cancel button? → **cursor change, click anywhere else to cancel**
- SQLite worker bundle: Vite's worker import (`import Worker from './worker.ts?worker'`) — confirm the sqlite-wasm files load correctly from OPFS-bound Worker context
- UUID source: `crypto.randomUUID()` — baseline browser support is fine (all modern browsers since 2022)
