# Phase 1C Implementation Plan

> **Executor:** subagent-driven-development, same pattern as 1B. Waves run in parallel internally; serialize between waves. Each task is one commit.

**Goal:** Implement Phase 1C per `docs/plans/2026-04-17-phase-1c-design.md`.

**Working directory for all tasks:** `.worktrees/phase-1c`
**Branch:** `feat/phase-1c`

**Conventions:**
- TDD where possible (test before impl); for pure DOM / worker glue, skip unit tests (runtime smoke instead).
- Each task ends with `bun run typecheck` + relevant `bun test` + commit.
- No `bun x` prefix in commands (scripts already unwrapped in package.json).

---

## Wave 1 — Primitives (parallel, 5 tasks)

### T1: Tile.Stairs + stairs placement
**Files:** `src/core/types.ts` (add `Tile.Stairs = 3`), `src/procgen/floor.ts` (place stairs on a non-spawn room center)
**Tests:** extend `tests/procgen/floor.test.ts`:
- For depth < 5, floor has exactly one `Tile.Stairs`
- Stairs never placed on a spawn tile
- `generateFloor(rng, w, h, { hasStairs: boolean })` — pass `false` to skip (for boss floor)
**Commit:** `feat(procgen): stairs tile + placement`

### T2: Camera module
**Files:** `src/render/camera.ts` (new), `tests/render/camera.test.ts` (new)
**API:**
```ts
computeCameraOffset(heroDisplay: {x,y}, tileSize: number, viewportW: number, viewportH: number, floorW: number, floorH: number): { x: number; y: number }
screenToWorldTile(clientX, clientY, canvasRect, canvasSize, tileSize, cameraOffset): Pos
```
**Tests (pure):**
- Offset zero when floor fits viewport
- Offset clamped to [0, floor*tile - viewport] on both axes
- Hero at corner → offset stays clamped, hero not centered
**Commit:** `feat(render): camera offset + screen-to-tile mapping`

### T3: Dev flags expansion
**Files:** `src/dev/flags.ts` (+pauseEnemies, invincibleHero, revealMap, volume: number)
**Tests:** extend `tests/dev/flags.test.ts`
- Defaults: `pauseEnemies=false, invincibleHero=false, revealMap=false, volume=0.5`
- Volume is a number, not boolean; validate range 0..1 in setter (clamp)
**UI:** extend `src/ui/devMenu.ts` — volume slider (range input 0-100), 3 new checkboxes
**Commit:** `feat(dev): flags for pause/invincible/reveal/volume`

### T4: Card content + loader
**Files:** `src/content/cards.json` (6 cards from spec §8), `src/content/cardLoader.ts` (new), `tests/content/cardLoader.test.ts`
**Tests:**
- `getCard('bless')` returns well-formed `CardDef`
- `listCardIds()` returns 6 entries
- Throws on unknown id
**Commit:** `feat(content): 6 starter cards + loader`

### T5: StatusEffect types + tick decrement
**Files:** `src/core/types.ts` (+StatusEffect, Actor.statusEffects: StatusEffect[]), `src/core/state.ts` (init `[]`), `src/core/reducers/turn.ts` (decrement remainingTicks on each TurnAdvance; purge when ≤ 0), `tests/core/reducers/turn.test.ts` (extend)
**Tests:**
- Status with remainingTicks=3 → 2 → 1 → gone across 3 TurnAdvance calls
- Stack: multiple effects on same actor decrement independently
**Note:** effective atk/def calculation comes in attack reducer; that's Wave 2 T7. This task only sets up the type + decrement.
**Commit:** `feat(core): status effects with per-tick decrement`

---

## Wave 2 — Gameplay actions (parallel after Wave 1, 4 tasks)

### T6: Descend action + reducer
**Files:** `src/core/types.ts` (+run.depth, run.cards, run.pendingReward), `src/core/state.ts` (init run object, starter deck, draw hand=3), `src/core/reducers/descend.ts` (new), `src/core/reducers/index.ts` (wire), `tests/core/reducers/descend.test.ts`
**Tests:**
- `Descend` on depth 1 with hero on stairs → depth=2, new floor, hero at spawn[0], hp preserved
- Hero NOT on stairs tile → Descend no-op (returns state)
- Depth=5 reach is boss floor; Descend from depth 5 is no-op (spec says boss is terminal via kill-all)
- New floor generated deterministically from seed+depth
**Commit:** `feat(core): descend action, multi-floor run state`

### T7: Card reducers + status-effect-aware combat
**Files:** `src/core/reducers/card.ts` (new — PlayCard, OfferCardReward, PickCardReward), `src/core/reducers/attack.ts` (factor in buff-atk / debuff-def), `src/core/reducers/index.ts`, `tests/core/reducers/card.test.ts`, extend `tests/core/reducers/attack.test.ts`
**Tests (card):**
- PlayCard removes from hand → discard; applies effect
- PlayCard with invalid cardId → no-op
- PlayCard requiring target without target → no-op
- Heal caps at maxHp
- Storm damages ALL alive enemies on floor
- OfferCardReward sets pendingReward
- PickCardReward adds card to deck, clears pendingReward, transitions phase back to 'exploring'
**Tests (attack with status):**
- Hero with buff-atk+2 deals extra 2 damage
- Enemy with debuff-def-1 takes extra 1 damage from hero
**Commit:** `feat(core): card plays, rewards, status-effect damage modifiers`

### T8: BFS chase (replace greedy)
**Files:** `src/ai/behaviors/chase.ts` (rewrite to call `firstStepToward` with `passThroughActors: [heroId]`), delete sideways-probe helper
**Tests:** existing `tests/ai/planner.test.ts` — update expected behavior if needed. Sideways-probe test still passes (BFS handles the case).
**Commit:** `refactor(ai): enemies use BFS chase`

### T9: Boss archetype + boss-floor generator
**Files:** `src/content/archetypes.json` (+skull-emperor), `src/procgen/boss.ts` (new — `generateBossFloor(rng, w, h)` returns `{ floor, rng }` with no stairs, boss-suitable layout), `tests/procgen/boss.test.ts`
**Tests:**
- `generateBossFloor` returns floor with no Tile.Stairs
- Exactly one spawn point reserved for boss, 2 for escorts, 1 for hero
**Commit:** `feat(content+procgen): skull emperor + boss floor`

---

## Wave 3 — UI (parallel after Wave 2, 4 tasks)

### T10: Card hand UI
**Files:** `src/ui/cardHand.ts` (new, DOM — no innerHTML), wire in main.ts
**Behavior:** horizontal strip at bottom, one button per card in hand. Click = enter target-select mode if needed, else click-to-confirm.
**No unit test.** Runtime smoke only.
**Commit:** `feat(ui): card hand strip + target select`

### T11: Card reward modal
**Files:** `src/ui/cardReward.ts` (new, DOM), wire in main.ts
**Behavior:** when phase='card_reward', show 3 card buttons. Click = PickCardReward.
**Commit:** `feat(ui): between-floor card reward modal`

### T12: HUD depth counter
**Files:** extend `src/ui/hud.ts` — add depth indicator "Floor N / 5"
**Commit:** `feat(ui): hud shows current depth`

### T13: Dev menu slider + new checkboxes
**Files:** `src/ui/devMenu.ts` (add volume slider + 3 new flag checkboxes)
**Tests:** none (visual)
**Commit:** `feat(ui): dev menu volume slider + new flags`

---

## Wave 4 — Persistence (serial, 3 tasks)

### T14: SQLite worker (schema + message loop)
**Files:** `src/persistence/db/worker.ts` (new, runs in Web Worker), `src/persistence/db/schema.sql` (new), install dep `@sqlite.org/sqlite-wasm`
**API (message types):**
- `{ kind: 'start-run', runId, seed }`
- `{ kind: 'append-event', runId, idx, tick, actionJson }`
- `{ kind: 'end-run', runId, outcome, finalTick }`
- `{ kind: 'get-latest-unended' }` → response with run data or null
- `{ kind: 'delete-run', runId }`

Worker initializes `@sqlite.org/sqlite-wasm`, opens OPFS file (fall back to in-memory), runs schema, listens for messages.
**Tests:** skipped (worker glue; smoke-tested at runtime). Add one integration test via vitest-style worker harness if easy; otherwise note.
**Commit:** `feat(persistence): sqlite worker with opfs backing`

### T15: DB client + batched writer
**Files:** `src/persistence/db/client.ts` (new), `tests/persistence/db/client.test.ts` (mock Worker)
**API:** as spec §11. Batches events with 50ms debounce. Flushes on beforeunload.
**Tests (with mock Worker):**
- appendEvent queues, flushes after debounce
- Multiple appendEvents in quick succession → one flush message containing all
- endRun flushes first, then sends end
**Commit:** `feat(persistence): batched db client`

### T16: Auto-resume on boot
**Files:** `src/persistence/autoResume.ts` (new), integrate into `src/main.ts`
**Logic:**
1. URL `?run=` → decode + replay (existing)
2. Else query DB `getLatestUnended`. If found with non-empty log → replay. If empty → delete + fresh.
3. Else → fresh run + startRun(newId, seed)
On every successful dispatch → appendEvent. On RunEnd → endRun.
**Tests:** `tests/persistence/autoResume.test.ts` — simulate URL vs DB vs fresh paths with mocked client
**Commit:** `feat(persistence): auto-resume run on boot`

---

## Wave 5 — Integration & polish (serial, 3 tasks)

### T17: Wire camera + input mapping + render pipeline
**Files:** `src/main.ts`, `src/input/dev.ts` (screen→world coords via camera offset), `src/render/world.ts` (apply camera translate)
**Tests:** update existing dev input tests if any; manual smoke for viewport scroll
**Commit:** `feat: camera, screen-to-world mapping, render integration`

### T18: Full integration + manual smoke pass
**Files:** README.md (update controls + Phase 1C section), verify end-to-end in browser
**Manual checklist (for user):**
- Descend stairs → new floor
- Play each card at least once — effects land, SFX fires
- Pick card reward between floors
- Boss on floor 5, heavier than mooks
- Kill boss → win overlay
- Die → lose overlay
- Refresh mid-run → auto-resume
- Dev menu (backtick): pause enemies, invincible, volume slider all functional
**Commit:** `docs: phase 1c readme + manual smoke checklist`

### T19: Closing verification
- `bun test` full suite green
- `bun run typecheck` clean
- `bun run build` clean, bundle size reported
- `git log` shows clean history per task
**Commit:** `chore: phase 1c closing checks` (only if any fix-ups needed)

---

## Dispatch notes

- Worker from `Wave 1`: T1..T5 all independent (touch disjoint files), dispatch all 5 in parallel.
- Wave 2: T6-T9 touch disjoint files but T6+T7 both modify `core/reducers/index.ts` and `core/types.ts`. Dispatch T6 first, then T7 serially (since both edit same files). T8 + T9 parallel with T7.
  - Safer: dispatch T6, then T7, T8, T9 in parallel.
- Wave 3: T10-T13 all touch disjoint files. Full parallel.
- Wave 4: T14 → T15 → T16 strictly serial.
- Wave 5: T17 → T18 → T19 serial.

Estimate: 19 tasks, ~2-4 hours wall clock with parallel dispatch.

## Success criterion

All ship-criterion items from spec §15 pass. Merge to master via the `git reset --hard` bypass (user already approved this pattern).
