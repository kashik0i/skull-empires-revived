# Phase 1D — Narrative & Content Depth (Light tier)

**Status:** Spec, awaiting plan.
**Predecessor:** `docs/plans/2026-04-17-phase-1c-design.md` (multi-floor, cards, boss, persistence) — shipped at master.
**Successor targets:** Phase 1F (HUD layout + music/SFX polish), Phase 2 (LLM mind).

## Goal

Add narrative hooks and mid-run variety without building dialog-tree tooling. Stay terse; keep the dark-fantasy minimalism. Seed a short lore arc and give the player agency *between* kill-all rewards.

## Non-goals (explicitly deferred)

- Dialog trees, NPC memory, persuade/barter — waits for Phase 2 (LLM mind).
- Codex/review menu for lore — Light tier = read once, gone.
- New enemy archetypes — current 5 + boss are enough.
- Equipment slots, inventory system — flasks already cover progression.
- Music and SFX polish — Phase 1F.
- HUD repositioning — Phase 1F.

## Scope

### 1. NPCs — Merchant

**Type plumbing.** Add `'npc'` to the `Actor.kind` union. Consequences:

- `attackActor` reducer rejects attacks when target is `kind: 'npc'`.
- `decide` / `chase` AI returns a no-op for NPC actors.
- `intentForClick` treats a click on an NPC tile as "interact" (open modal), not "attack".

**Merchant archetype.** New entry in `archetypes.json`:

```
"merchant": {
  "kind": "npc",
  "name": "Grim the Wanderer",
  "hp": 1, "maxHp": 1, "atk": 0, "def": 0,
  "sprite": "wizzard_m_idle"
}
```

(HP/ATK/DEF stats are required by `ArchetypeDef` but unused — NPCs can't be damaged.)

**Spawning.** Merchant appears on **floors 2 and 4** only. Placed during procgen in a fixed corner of the room containing hero spawn, offset by (2, 0) tiles if walkable, else (0, 2), else skipped. Handled via a new `spawnNpc` helper in `state.ts` called from `createInitialWorld` (for floor 1: no merchant) and `descend.ts` (for depth ∈ {2, 4}).

**Interaction flow.** Clicking an NPC anywhere on the map sets a new hero intent: `{ kind: 'interact'; targetId: npcId }`. `resolveHeroActions` paths the hero adjacent to the NPC using BFS (same as for attack). When the hero is adjacent, the loop emits a new `OpenMerchantDialog` action which sets `world.pendingDialog` with the merchant's 3 card offers.

The generic dialog modal then renders:

```
"Grim sets his wares down."
[Greater Heal]   [Fortify]   [Vigor]
```

The 3 buttons are drawn deterministically from the current card pool using world RNG (advances `world.rng`). Picking a button adds that card id to `world.run.cards.deck` and removes the merchant actor for this floor.

**Merchant vanishes after one transaction** this floor. On descend to a new floor-2/4, a new merchant appears.

### 2. Lore scrolls

One scroll per non-boss floor (depths 1-4). Placed during procgen on a random floor-interior tile (not on a spawn, not the stairs). Stored as a new field on `World`:

```
loreScrolls: { id: string; pos: Pos; fragmentIndex: number }[]
```

Scroll rendering reuses the existing `droppedItems` code path — renderer loops over `loreScrolls` and calls `drawSprite('scroll_open_anim_f0', ...)` with the same bob animation.

**Pickup.** Handled atomically in the `moveActor` reducer exactly like items: when the hero steps onto a scroll tile, the scroll is removed from `loreScrolls` and a dialog modal is queued via a new transient field `world.pendingDialog`. No separate `PickupScroll` action — replay determinism is already provided by the `MoveActor` action that triggered the step.

`pendingDialog` is `{ title: string; body: string; actions: { label: string; resolve: Action | null }[] } | null`. The UI reads this; when the player closes the modal, the UI dispatches a `ClearDialog` action (or the chosen `resolve` action if any, followed by `ClearDialog`).

**Lore content.** Four hand-authored fragments in a new file `src/content/lore.json`:

```
[
  { "id": 0, "title": "Fragment 1/4", "body": "Before the skulls, there were kings..." },
  ...
]
```

Fragment order matches `fragmentIndex` per floor (depth 1 = fragment 0, depth 4 = fragment 3). 4 fragments ≈ a tight 4-beat arc about the Skull Empire's fall. Copy drafted during implementation; each ≤ 3 sentences.

### 3. Shrines

**New tile type.** `Tile.Shrine = 4` added to the tile union in `types.ts`. Procgen change: 25% of non-boss floors get exactly one shrine tile placed during `generateFloor`. Chosen from a random non-spawn, non-stairs floor tile. Deterministic via `world.rng` advancement.

**Rendering.** `renderWorld` handles `Tile.Shrine` like `Tile.Stairs` — draws the floor sprite underneath, then overlays a shrine glyph (small stacked amber blocks or a simple vertical pillar drawn procedurally — no new atlas sprite required for v1).

**Pathfinding / walkability.** Shrine tiles are walkable (same as floor + stairs). Update the existing walkability predicates in `pathfind.ts`, `intent.ts`, `move.ts` to include `Tile.Shrine`.

**Interaction.** `moveActor` reducer detects when the hero steps onto a shrine tile. Sets `world.pendingDialog` with:

```
title: "An altar hums."
body: "Blood from the bowl, or breath from the flame?"
actions: [
  { label: "Blood", resolve: special action → +2 maxHp, +2 hp },
  { label: "Breath", resolve: special action → +1 atk permanent },
]
```

To avoid a combinatorial explosion of Action types, shrine resolution uses a single new action:

```
| { type: 'ResolveShrine'; choice: 'blood' | 'breath'; pos: Pos }
```

`ResolveShrine` reducer: apply the stat change, convert the shrine tile to `Tile.Floor`. The `pendingDialog` is cleared by the UI (via `ClearDialog`).

### 4. Three new cards

Add to `src/content/cards.json`. No reducer changes — all three reuse existing effect kinds:

```
{ "id": "greater-heal", "name": "Greater Heal",
  "description": "Restore 12 HP",
  "target": "self", "effect": { "kind": "heal", "amount": 12 } },

{ "id": "fortify", "name": "Fortify",
  "description": "+2 DEF for 6 ticks",
  "target": "self",
  "effect": { "kind": "buff-def", "amount": 2, "durationTicks": 6 } },

{ "id": "vigor", "name": "Vigor",
  "description": "+3 ATK for 3 ticks",
  "target": "self",
  "effect": { "kind": "buff-atk", "amount": 3, "durationTicks": 3 } },
```

Card pool size goes from 6 → 9. Starting hand draws 3 (unchanged) — but the deck has 6 cards instead of 3 at boot, giving more variety per run.

**Note:** `card.ts` reducer doesn't currently handle `buff-def`. Verify during implementation — if the only card handler is `buff-atk`, add a symmetric `buff-def` branch that pushes a `{ kind: 'buff-def', amount, remainingTicks }` status effect onto the hero. (Tiny, obvious change.)

### 5. Generic dialog modal

New file: `src/ui/dialog.ts`. API:

```ts
export type DialogButton = { label: string; onClick: () => void }
export type DialogSpec = { title: string; body: string; buttons: DialogButton[] }

export function mountDialog(parent: HTMLElement): {
  root: HTMLElement
  update(state: World): void
}
```

`update(state)` reads `world.pendingDialog`. If set, builds the modal from it; if null, hides. On a button click, the UI dispatches the bound action and then dispatches `{ type: 'ClearDialog' }`.

Styling mirrors the existing `cardReward` modal: centered panel, amber gothic title, sans-serif body, button row. Reused color tokens from `palette.ts`.

**One modal at a time.** If a new `pendingDialog` arrives while one is open (shouldn't happen in practice — player can't move during a modal — but guard anyway), the newer one replaces the older one. Queueing is out of scope.

## Data model summary

Additions to `World`:

```ts
loreScrolls: { id: string; pos: Pos; fragmentIndex: number }[]
pendingDialog: null | {
  title: string
  body: string
  actions: { label: string; resolve: Action | null }[]
}
```

New `Actor.kind`: `'hero' | 'enemy' | 'npc'`.

New `Tile`: `Shrine = 4`.

New `Action` variants:

```
| { type: 'OpenMerchantDialog'; merchantId: ActorId }
| { type: 'MerchantTrade'; cardId: string; merchantId: ActorId }
| { type: 'ResolveShrine'; choice: 'blood' | 'breath'; pos: Pos }
| { type: 'ClearDialog' }
```

New `HeroIntent` variant:

```
| { kind: 'interact'; targetId: ActorId }
```


## File changes

**Create:**
- `src/content/lore.json` — 4 lore fragments.
- `src/ui/dialog.ts` — generic modal component.
- `src/core/reducers/dialog.ts` — handles `ClearDialog`, `OpenMerchantDialog`, `ResolveShrine`, `MerchantTrade`.
- `tests/core/reducers/dialog.test.ts`.
- `tests/core/reducers/npc.test.ts` — attack reducer rejects NPC as target.
- `tests/procgen/shrine.test.ts` — 25% shrine rate verified over many seeds.

**Modify:**
- `src/core/types.ts` — new kinds, new tile, new actions, new World fields.
- `src/core/state.ts` — init `loreScrolls: []`, `pendingDialog: null`; new `spawnNpc` helper. `createInitialWorld` (depth 1) places no merchant; `spawnNpc` is called by `descend.ts` only when newDepth ∈ {2, 4}.
- `src/core/reducers/index.ts` — wire new action handlers.
- `src/core/reducers/attack.ts` — reject NPC target.
- `src/core/reducers/move.ts` — handle step-onto-shrine and step-onto-scroll by emitting `pendingDialog`.
- `src/core/reducers/descend.ts` — call `spawnNpc` when newDepth ∈ {2, 4}; reset `loreScrolls` per floor; clear `pendingDialog`.
- `src/core/reducers/card.ts` — add `buff-def` branch if absent.
- `src/procgen/floor.ts` — scroll placement, shrine placement, NPC spawn coordination.
- `src/ai/behaviors/chase.ts` — NPC no-op.
- `src/ai/pathfind.ts` — `Tile.Shrine` walkable.
- `src/input/intent.ts` — click on NPC tile → `{ type: 'SetHeroIntent', intent: { kind: 'interact', targetId: npcId } }`. `Tile.Shrine` treated as walkable.
- `src/ai/heroAuto.ts` — handle the new `interact` intent: BFS-path adjacent to the NPC; when already adjacent, emit `OpenMerchantDialog` and clear the intent.
- `src/render/world.ts` — render shrine tile (procedural glyph), render `loreScrolls` the same way as items.
- `src/render/sprites.ts` — add `wizzard_m_idle`, `scroll_open_anim` frames.
- `src/content/archetypes.json` — merchant entry.
- `src/content/cards.json` — 3 new cards.
- `src/main.ts` — mount `dialog` component, update it each frame.

## Testing

Unit tests:
- NPC cannot be attacked by hero (attack reducer returns state unchanged).
- Shrine resolution: `ResolveShrine({choice: 'blood'})` → hero maxHp +2, hp +2; shrine tile becomes Floor.
- Shrine resolution: `ResolveShrine({choice: 'breath'})` → hero atk +1; tile becomes Floor.
- Scroll pickup → `loreScrolls` loses the entry; `pendingDialog` set with fragment body.
- `ClearDialog` nulls `pendingDialog`.
- Merchant trade → card added to deck; merchant removed from actors.
- Procgen: 25% shrine rate across 200 seeds (within ±5%).
- Procgen: each non-boss floor has exactly 1 scroll.

Integration test:
- Play a full scripted run with scripted merchant/shrine/scroll interactions. Verify replay determinism.

## Success criteria

- On floor 2 or 4 a merchant sprite is visible; clicking opens modal; picking a card adds it to the deck; merchant gone after.
- Floors 1-4 each place exactly one scroll; walking onto it pops a 1-paragraph lore modal.
- At ~25% per non-boss floor, expect ~1 shrine per 4-floor run on average; choosing Blood or Breath applies the permanent effect and the shrine tile converts to Floor.
- 9 cards available in the pool; all three new cards playable when drawn.
- All existing tests still pass; new tests green.
- `bun run build` clean; `bun run typecheck` clean.

## Risks / open questions

- **Merchant sprite pick.** `wizzard_m_idle` or similar NPC sprite from the atlas — confirm at implementation time.
- **Scroll sprite.** `scroll_open_anim_f0` may be wrong name; grep `tiles_list_v1.3.txt` during impl.
- **Dialog ordering on rapid step.** If the hero auto-paths into a shrine tile and the next scheduled step is a scroll pickup on the very next turn, we need to not lose one dialog. Mitigation: when `pendingDialog` is set, `resolveHeroActions` returns empty until `ClearDialog` fires. Tested via integration test.
- **Merchant trade RNG.** The 3 card choices are drawn deterministically from `world.rng`. Confirm the same 3 cards aren't drawn (use a without-replacement shuffle of pool size 9).

## After Phase 1D

- **Phase 1F (HUD + audio polish):** move minimap and log off-canvas into a persistent side panel so no UI overlays tiles; commission or source a dark-fantasy music loop + richer SFX pass.
- **Phase 2 (LLM mind):** WebLLM planner; replace merchant static lines with LLM-generated dialog with persona prompt; hero turn-planner LLM toggle; NPC memory across runs via the existing SQLite persistence.
