# Phase 1E — Inventory, Equipment, Potions, Music

**Status:** Design (approved 2026-04-18)
**Goal:** Replace one-shot card hand with persistent equipment + reactive potions. Add visual variety from the 0x72 atlas. Add procedural ambient music.

## Why

Cards were the prototype combat-customisation surface. They worked but felt
shallow — every floor draws the same hand of effects, no persistent build
identity, and the merchant trade landed cards into a deck that often never
surfaced. Equipment + consumables map closer to roguelike conventions and
give the player a build to grow over a run.

Sprite variety + music are quality-of-life polish that have been deferred.
Bundling them with Phase 1E means the visual + audio refresh lands together
with the new gameplay surface, instead of trickling.

## Non-goals

- Coin economy. Trades are still item-for-nothing.
- Item rarity / random stat rolls. Each item has fixed stats.
- Equipment durability.
- Multiple weapon classes (sword vs spear vs bow). One generic weapon slot.
- Item stacking — every potion takes a discrete inventory slot.
- Multi-channel music (just a single melodic + pad layer).
- Music interactivity (combat-aware shifts) — that is Phase 1F polish.
- Old-save replay compatibility.

## Mechanics

### Inventory

A 6-slot grid in the bottom HUD strip, replacing the card hand. Click a
slot to use (potion) or equip (weapon/armor). Drag-and-drop is a Phase 1F
nice-to-have, not in scope.

State: `World.inventory: Item[]` (length ≤ 6, sparse not allowed — items
shift left on remove).

When the inventory is full and a pickup happens, the item stays on the
ground; the hero gets a brief log line ("inventory full"). No autoswap.

### Equipment

Two slots: weapon and armor. State: `World.equipment: { weapon: Item | null;
armor: Item | null }`.

Equipping moves the item from inventory → equipment slot. If a slot is
already occupied, the previous item moves back to inventory in the same
action. Unequip moves the item from equipment → inventory. Both fail
silently if the inventory is full and the move would overflow.

### Items

Three categories, ten total:

- **Potions** (consumable, single-use)
  - `heal-small` — restore 5 HP (caps at maxHp)
  - `heal-large` — restore 12 HP (caps at maxHp)
  - `strength-tonic` — +2 atk for 5 ticks
  - `iron-tonic` — +2 def for 5 ticks
- **Weapons** (equippable, +atk passive)
  - `rusty-blade` (+1)
  - `iron-blade` (+2)
  - `ember-blade` (+3)
- **Armor** (equippable, +def passive)
  - `cloth-rags` (+1)
  - `leather-vest` (+2)
  - `plate-mail` (+3)

Items live in `src/content/items.json`, loaded via `src/content/itemLoader.ts`.

### Sources

- **Enemy drops:** 25% chance per kill to drop one item, sampled
  deterministically from a tier-appropriate pool weighted by depth (floor
  1-2 favours rusty/cloth/heal-small; floor 4 favours ember/plate/heal-large).
- **Merchant:** the trade dialog now offers 3 random items from a
  depth-weighted pool. RNG threading identical to the current
  `openMerchantDialog`.
- **End-of-floor reward:** picks 3 items from a deeper pool than the floor
  drop. Replaces the card-reward modal one-for-one.

### Effective stats

`selectors.ts` gains `effectiveAtk(state)` and `effectiveDef(state)` that
sum: actor base atk/def + equipped weapon/armor bonus + active status
effects. The HUD reads from these, so Fortify-style buffs and equipment
both show up correctly. (This folds in a Phase 1D backlog item.)

## Removed

The card system goes entirely. Files deleted:

- `src/content/cards.json`
- `src/content/cardLoader.ts`
- `src/core/reducers/card.ts`
- `src/ui/cardHand.ts`
- `src/ui/cardReward.ts`
- `tests/core/reducers/card.test.ts`
- `tests/content/cardLoader.test.ts`

Action types removed from the union: `PlayCard`, `OfferCardReward`,
`PickCardReward`, `MerchantTrade`. Reducer cases removed. World fields
removed: `run.cards`, `run.pendingReward`, `run.rewardedThisFloor`.

The `targetingCardId` plumbing in `main.ts` and the click-targeting flow
in `attachDevInput` are removed.

### Old saves

Schema version bump in `src/persistence/db/schema.sql`. On load, the OPFS
client checks the version: if it doesn't match, it drops both tables
(`runs`, `events`) and recreates them. A single info-level log entry
("previous run wiped — schema upgrade") fires once. No migration code, no
back-compat shim.

## Sprite variety

### Tile variants

`FRAMES` gains 3 wall variants (`wall_top`, `wall_side`, `wall_corner_l`,
`wall_corner_r`) and 3 floor variants (`floor_1`, `floor_2`, `floor_3`).
The renderer picks a variant deterministically by `(x * 73 + y * 37) %
variantCount` so the tiling is stable per cell across frames but visually
varied across the floor.

Walls also pick variant based on neighbour analysis (top vs side) — a
small helper in `world.ts` checks the 4-neighbours and picks the matching
variant. This is the only piece that's not pure-random.

### New enemy archetypes

Add 3 new entries in `archetypes.json` using existing atlas sprites:
`chort` (small demon), `wogol` (cloaked imp), `ice_zombie` (slow tank).
Slot them into `FLOOR_COMPOSITIONS` for floors 2-4 to mix up encounters.

### Item ground sprites

Drops render with the matching atlas sprite (`weapon_red_gem`,
`armor_blue`, `flask_red`, etc.). The exact sprite name lives in the
`items.json` entry.

## Music

A small in-house procedural ambient generator. No external library — uses
Web Audio API directly to keep the bundle small.

### Architecture

`src/audio/music.ts` — exports `createMusic({ seed: string, depth: number })`
returning `{ start, stop, setVolume }`. Internally:

- One `AudioContext`, one master `GainNode` (wired to the existing volume
  control)
- One `OscillatorNode` for the lead melody (square wave, low duty)
- One `OscillatorNode` for the pad (triangle wave, slow attack/release)
- Per-floor mood: floors 1-3 = D minor, slow tempo (~60 BPM equivalent);
  floor 4 = G minor, faster (~80 BPM); floor 5 (boss) = D minor +
  augmented intervals, ~100 BPM
- Sequencer steps every `60_000 / bpm / 4` ms (sixteenth notes); each
  step optionally fires a note or rest
- Note picks from a fixed scale array, weighted toward the tonic and fifth
- Pad slowly cycles through chord roots every 4 bars

The whole module is ~150 LOC of straightforward Web Audio. No MIDI file
parsing, no sample playback.

### Wiring

`main.ts` instantiates `createMusic` after the existing `createSfx`. The
volume slider in the dev menu controls both via the existing master gain
chain. Music starts on first user interaction (browser autoplay policy)
and changes mood on `Descend`.

### Mute behaviour

If volume is 0, the music gain is 0 — no oscillator allocated until volume
> 0 to avoid the AudioContext warning before user gesture.

## File structure

| File | Action | Purpose |
|---|---|---|
| `src/core/types.ts` | modify | Add `Item`, `EquipmentSlot`, `World.inventory`, `World.equipment`; remove card types |
| `src/core/state.ts` | modify | Init inventory `[]`, equipment `{ weapon: null, armor: null }`; drop card init |
| `src/core/reducers/inventory.ts` | new | `useItem`, `equipItem`, `unequipItem`, `pickupItem` |
| `src/core/reducers/move.ts` | modify | Pickup writes to inventory (dispatch PickupItem) instead of in-place flask effect |
| `src/core/reducers/dialog.ts` | modify | `merchantBuyItem` (replaces `merchantTrade`); reuses RNG-shuffled pool |
| `src/core/reducers/descend.ts` | modify | Drop card-reward bookkeeping; carry inventory + equipment |
| `src/core/reducers/index.ts` | modify | Wire new actions, drop card cases |
| `src/core/selectors.ts` | modify | `effectiveAtk`, `effectiveDef` |
| `src/content/items.json` | new | 10-item catalogue |
| `src/content/itemLoader.ts` | new | `getItem`, `listItemIds`, `itemPoolForDepth(depth, slot)` |
| `src/content/cards.json` | delete | — |
| `src/content/cardLoader.ts` | delete | — |
| `src/core/reducers/card.ts` | delete | — |
| `src/ui/cardHand.ts` | delete | — |
| `src/ui/cardReward.ts` | delete | — |
| `src/ui/inventory.ts` | new | 6-slot grid, click-to-use/equip, tooltip |
| `src/ui/itemReward.ts` | new | post-floor item-of-3 picker |
| `src/ui/hud.ts` | modify | Effective ATK/DEF display |
| `src/render/sprites.ts` | modify | Tile variants + new character + item entries |
| `src/render/world.ts` | modify | Variant picker for walls/floors; item ground sprite render |
| `src/content/archetypes.json` | modify | Add chort, wogol, ice_zombie |
| `src/content/loader.ts` | modify | Allow new archetype kinds in the union if needed |
| `src/persistence/db/schema.sql` | modify | Version bump |
| `src/persistence/db/worker.ts` | modify | Version check + drop+recreate on mismatch |
| `src/audio/music.ts` | new | Procedural ambient |
| `src/audio/subscribe.ts` | modify | Wire music start/stop on Descend / RunEnd |
| `src/main.ts` | modify | Mount inventory UI, music, drop card mounts/handlers |

## Determinism

All randomness flows through `state.rng`:

- Enemy drops: `pickupItem` picks via a `nextU32(state.rng)` modulo a
  weighted pool, returns updated rng.
- Merchant pool shuffle: same as the current `openMerchantDialog`.
- End-of-floor reward: picks 3 items deterministically.
- Music: seeded from `world.seed + ':' + depth` so two players with the
  same seed hear the same tune on the same floor.
- Sprite tile variants: pure function of `(x, y)` — no rng consumed.

## Testing strategy

- Inventory reducer: full TDD, one test per action (use, equip, unequip,
  pickup), one test per edge (full inventory blocks pickup, equip-with-
  occupied-slot swaps, unequip-into-full-inventory rejects).
- Item loader: shape, count, depth pool composition.
- Selectors: effective stats with various equipment + buff combos.
- Persistence: schema mismatch wipes tables.
- Music: smoke test that `createMusic` returns a working handle (no audio
  assertions).
- Procgen: tile-variant picker is pure (test by hashing same coords
  returns same variant).

## Success criteria

1. Fresh run starts with empty inventory + no equipment.
2. Killing an enemy may drop an item; walking onto it picks it up if
   inventory has space.
3. Click a potion → effect applied, item consumed.
4. Click a weapon → equipped, atk reflected in HUD.
5. Click an equipped weapon → unequipped back to inventory.
6. Merchant offers 3 items; picking one consumes the merchant + adds to
   inventory.
7. End-of-floor reward offers 3 items; pick adds to inventory.
8. Floor visuals show tile variants (multiple wall/floor sprites).
9. Music plays from depth 1 and changes on descend.
10. Old saves auto-wipe on schema mismatch with a single log line.
11. All tests pass; typecheck clean; build clean.
