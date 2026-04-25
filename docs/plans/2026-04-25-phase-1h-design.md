# Phase 1H — World, Sprites & Build Display

**Status:** Design (in review, 2026-04-25)
**Goal:** Make the dungeon feel like a place by activating unused 0x72 atlas content (wall autotiling, doors, chests, room decor), expanding the weapon pool, replacing the skull-as-armor placeholder with real armor sprites, and surfacing the player's current build in the HUD.

## Why

After 1G the game's camera, zoom, and shake feel correct, but the world itself is still visually thin: walls are a single brick variant, every floor has the same flat layout language, the only loot path is enemy drops + merchant, and equipped armor renders as a skull. Meanwhile the 0x72 Dungeon Tileset II already loaded into `public/sprites/dungeon.png` contains far more than we use — corner/edge wall pieces for autotiling, animated doors and chests, banners, columns, crates, candles, and roughly ten more weapon variants. Activating that content costs no new asset weight and roughly doubles visual richness per floor.

Two things genuinely require new art: (1) armor sprites, because 0x72 has none, and (2) "current build" feedback in the HUD so the player can see what they're wearing without opening the inventory.

This phase is content + presentation. No combat math, AI, or persistence semantics change.

## Non-goals

- New enemy archetypes (the atlas has more, but expanding the bestiary is its own content drop).
- Item rarity tiers, sockets, crafting, or stat rolls — items remain fixed-stat.
- Lockable / keyed doors. All doors open on bump.
- Mimic chests, trapped chests, locked chests.
- Boss-floor decoration changes — the throne room's minimal layout is intentional.
- Hero sprite changing based on equipped gear (paper-doll deferred).
- Animated decoration (no flickering candle flames, no waving banners). Sprites are static frames even where the atlas offers an animated row.
- Pinch-zoom or new input modalities; keep 1G's camera + zoom contract.
- Mid-floor procgen changes that affect difficulty (door/chest placement is additive, not balance-altering).

## Architecture

### Wall autotiling

Today every wall tile renders as `wall_mid`. The 0x72 atlas has corner, edge, and inner-corner pieces that we can pick from based on each wall's neighbors.

- Add the missing wall frames to `FRAMES` in `src/render/sprites.ts`:
  `wall_corner_top_left`, `wall_corner_top_right`, `wall_corner_bottom_left`,
  `wall_corner_bottom_right`, `wall_side_mid_left`, `wall_side_mid_right`,
  `wall_inner_corner_l_top_left`, `wall_inner_corner_l_top_right`,
  plus `wall_top_left`, `wall_top_right` for capped runs.
  Frame coordinates are pulled from the atlas during implementation (the
  existing entries already map by-eye to known atlas regions, same approach).

- New helper `wallVariantForMask(mask: number): string` in
  `src/render/wallAutotile.ts`. The mask is 4 bits — N, E, S, W — set when
  the corresponding cardinal neighbor is also a Wall (or out-of-bounds,
  which counts as wall to avoid edge artifacts). Lookup table covers all
  16 cases; missing entries fall back to `wall_mid`.

- In `world.ts`, when rendering a Wall tile, compute the mask by reading
  its four neighbors from `floor.tiles`. The mask is cheap (four array
  reads + bit shifts) so we recompute per frame rather than caching;
  zoom and shake don't affect it, only floor changes do, and floor
  changes happen ~once per minute.

- The atlas's `wall_top_mid` (the 3D-overhang cap) stays unused — our
  view is flat top-down and the cap looks wrong against actor sprites
  that bottom-anchor to the tile.

### Doors

New tile values, placed by procgen at corridor/room boundaries:

- Extend `Tile` in `src/core/types.ts` with `DoorClosed = 5` and
  `DoorOpen = 6`. Encoding state in the tile value (rather than a
  separate doors map) keeps persistence trivial — `tiles: Uint8Array`
  serializes as-is — and matches the `Stairs` / `Shrine` pattern.

- Atlas frames: `door_closed` and `door_open` (already in 0x72; exact
  coords resolved during implementation).

- Movement / pathing rules:
  - Closed door: not passable. Bump intent (move-to a closed door tile)
    transitions the tile to `DoorOpen` and the actor's intent path
    re-runs next tick. The bump consumes the actor's turn.
  - Open door: passable like Floor. Stays open permanently.

- FOV rules in `src/render/fov.ts`:
  - Closed door: opaque (treat as Wall).
  - Open door: transparent (treat as Floor).

- Procgen placement in `src/procgen/floor.ts`:
  - After corridors are carved, scan corridor tiles. A door candidate
    is a corridor tile with exactly one cardinal Floor neighbor that
    belongs to a room. Place 1–2 doors per floor by sampling from
    candidates with the floor's RNG. Skip the boss floor.
  - Doors only on non-boss floors. Boss room stays open.

### Chests

A new placed feature, one per non-boss floor:

- Extend `Tile` with `Chest = 7` and `ChestOpen = 8`.

- Atlas frames: closed = first frame of `chest_full_open_anim`,
  open = last frame of the same animation. Static, not animated.

- Step-onto-chest semantics: passable. Walking onto a closed chest
  (a `Tile.Chest`) in the move reducer:
  1. transitions the tile to `ChestOpen`,
  2. picks an item from the depth-tiered pool (same pool as enemy
     drops, depth = current floor depth),
  3. emits a `DroppedItemInstance` on an adjacent passable tile if any,
     else on the chest tile itself,
  4. logs "You open the chest. \<Item Name\> drops."

- Placement in procgen: choose one room (not the spawn room, not the
  stairs room) and put the chest at its center. If only spawn and
  stairs rooms exist (rare on small floors), skip — chestless floors
  are acceptable.

- Persistence: state lives in the tile array, so save/load is free.
  Item drops use the existing `groundItems` array, also already saved.

### Room decoration

Pure-cosmetic props placed inside rooms:

- New optional field on `Floor`:
  `decor?: { x: number; y: number; sprite: string }[]`.
  Generated post-procgen with the floor's RNG, deterministic for the
  same seed.

- Sprite pool (all from 0x72): `wall_banner_red`, `wall_banner_blue`,
  `wall_banner_green`, `wall_banner_yellow`, `column_top` + `column_mid`
  (rendered as a vertical pair on the same tile column when room height
  permits), `crate`, `skull` (decorative — different from the armor
  placeholder it currently substitutes for).

- Placement rules:
  - Banners only on a Floor tile that has a Wall to the north (so the
    banner reads as hanging from the wall). Render at the top of the
    tile, not centered.
  - Columns at one of the room's interior corners, not on a corridor
    junction.
  - Crates / skulls anywhere on a Floor tile that isn't a spawn, the
    stairs, the scroll, the shrine, the chest, or a door.
  - 0–3 props per room, weighted toward larger rooms.

- Render in `world.ts` between the floor pass and the actor pass.
  Decor inherits visibility state from its host tile (visible / seen /
  unknown), so a banner can't leak the existence of an unseen wall.

- Decor doesn't block movement or FOV. It is purely a sprite layer.

### Weapon expansion

Pure data change:

- Extend `src/content/items.json` from 3 weapons to 8. Existing
  entries (`rusty-blade` atk 1, `iron-blade` atk 2, `ember-blade`
  atk 3) keep their stats — no balance change to current items.
  Five new weapons fill the curve:
  `knight-blade` (atk 3), `duel-blade` (atk 3),
  `flame-blade` (atk 4), `golden-blade` (atk 4),
  `royal-blade` (atk 5).

  Sprite mappings for the new entries: `weapon_knight_sword`,
  `weapon_duel_sword`, `weapon_anime_sword`, `weapon_golden_sword`,
  `weapon_lavish_sword`. The three existing sprite mappings stay.

- Add the new weapon frames to `FRAMES` in `sprites.ts`. The existing
  three sword entries already document the geometry (10×21,
  single-frame).

- Tier the drop pool by depth (already a concept in `itemLoader`):
  floor 1 weights low-tier, floor 5 weights high-tier. Concrete
  weights live in `itemLoader.ts` next to the existing tier logic;
  follow the pattern already used for the three current weapons.

### Armor sprites

The only genuinely new asset, sourced from a downloadable CC0 pack
(no hand-drawing, no AI-generated art):

- **Source pack:** [DawnLike](https://opengameart.org/content/dawnlike-16x16-universal-rogue-like-tileset-v181)
  by DragonDePlatino — 16×16, public domain, fantasy roguelike
  tileset with extensive armor variety. Style pairs reasonably with
  0x72 (both are 16×16 chunky pixel-art with dark outlines). Backup
  pick if DawnLike doesn't fit: Kenney's
  [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) — CC0,
  cleaner style, also viable.

- **Extraction step (one-time, executed during 1H implementation):**
  Pull three armor body sprites from the pack — one cloth-tier, one
  leather-tier, one plate-tier — and pack them horizontally into a
  single new file `public/sprites/armor.png` at 48×16 (three 16×16
  frames). Picking from a single pack keeps the visual style
  consistent across the three tiers.

- **Attribution:** add a line to
  `public/sprites/ATLAS_ATTRIBUTION.txt` crediting the source pack
  (DawnLike is public domain so it's a courtesy, not a requirement;
  Kenney is CC0 with optional credit).

- New loader `loadArmorAtlas()` in `sprites.ts`, mirroring
  `loadAtlas`. The two atlases are independent images; `getFrame`
  and `drawSprite` accept an atlas argument or pick the right one
  based on the frame name's prefix (`armor_*` → armor atlas,
  anything else → dungeon atlas).

- Replace the current "skull placeholder" entries for `armor_cloth` /
  `armor_leather` / `armor_plate` with frames pointing into the new
  atlas at offsets 0/16/32, all 16×16, single-frame.

- Fallback path: if `armor.png` 404s in dev, the sprite drawer logs
  once and renders the existing skull frame instead. No crash, no
  blocked boot — implementation can begin before the asset file
  lands, and tests don't depend on it.

### Build display in HUD

The side panel's `equipment` slot already exists and already renders
text lines for weapon and armor. This phase adds sprite icons:

- Each line in the equipment slot becomes `[icon] Name (+stat)`,
  where the icon is a 32×32 (16-source × 2 scale) canvas drawn from
  the item's `sprite` field via the existing `drawSprite` path.

- Empty slot: render a faded-outline placeholder square the same size
  so the layout doesn't jump when equipping/unequipping.

- The slot's outer container stays the same height; only the inner
  layout changes from `text` to `flex-row { icon, text }`.

## Data flow

```
   ┌───────────────────────┐
   │  procgen/floor.ts     │  ── BSP → tiles[] → place stairs/shrine
   │                       │              ↓
   │                       │  ── place doors (corridor↔room edges)
   │                       │              ↓
   │                       │  ── place chest (one room interior)
   │                       │              ↓
   │                       │  ── place decor (banners/columns/crates/skulls)
   └──────────┬────────────┘
              │ Floor { tiles, decor }
              ▼
   ┌───────────────────────┐    ┌──────────────────────┐
   │  reducers (move)      │    │  render/world.ts     │
   │  step-onto-chest →    │    │   floor pass →       │
   │    open + drop item   │    │   wallAutotile mask  │
   │  bump-closed-door →   │    │   decor pass →       │
   │    open, consume turn │    │   actors pass        │
   └───────────────────────┘    └──────────────────────┘

   ┌───────────────────────┐    ┌──────────────────────┐
   │  ui/sidePanel         │    │  render/sprites.ts   │
   │  equipment slot:      │←───│  drawSprite(item.sprite)
   │   [icon] Name (+stat) │    │   loadArmorAtlas()  │
   └───────────────────────┘    └──────────────────────┘
```

## Tests

New unit tests, all in Bun:

- `wallAutotile.test.ts`
  - Every 4-bit mask returns a defined frame name (16 cases).
  - Mask `0b0000` (isolated wall) returns the pillar variant.
  - Mask `0b1111` (fully surrounded) returns the inner-fill variant
    (`wall_mid`).
  - Edge masks (only N, only E, etc.) return the corresponding
    side / corner frames.

- `door.test.ts`
  - Closed door is opaque to `computeVisible`; open door is transparent.
  - Move-to a closed door transitions it to `DoorOpen` and consumes
    the actor's turn (no further movement that tick).
  - Move-to an open door passes through normally.

- `chest.test.ts`
  - Step onto `Tile.Chest` transitions tile to `Tile.ChestOpen` and
    appends a `DroppedItemInstance` with a depth-appropriate item.
  - Subsequent steps onto `ChestOpen` are no-ops (no double-drop).
  - Chest with no adjacent passable tile drops the item on its own
    tile.

- `floor.test.ts` (extension)
  - Door count: 1–2 per non-boss floor, 0 on the boss floor.
  - Chest count: exactly 1 per non-boss floor when ≥3 rooms exist.
  - Decor never overlaps spawn / stairs / shrine / scroll / chest /
    door tiles.
  - Decor is deterministic for a fixed seed.

- `persistence.test.ts` (extension)
  - Round-trip a floor with a closed door, an open door, a closed
    chest, and an open chest. All four tile values restore exactly.

- No new tests for the equipment-slot icon — it's a render concern
  with no logic branches worth covering.

## Integration points

- `core/types.ts` — extend `Tile` with `DoorClosed`, `DoorOpen`,
  `Chest`, `ChestOpen`. Extend `Floor` with optional `decor` field.

- `core/selectors.ts` — `isPassable(tile)` returns true for `Floor`,
  `Stairs`, `Shrine`, `DoorOpen`, `Chest`, `ChestOpen`. Closed door is
  not passable but is a valid bump target (the move reducer handles
  the transition before checking passability — see Risks #2).

- `core/reducers/move.ts` (or wherever the move action resolves) —
  add the door-bump and chest-step handlers. Both are pre-checks
  before normal move semantics.

- `procgen/floor.ts` — extend with door pass, chest pass, decor pass.
  All three consume the floor's RNG so seeds remain deterministic.

- `render/fov.ts` — closed door is opaque.

- `render/world.ts` — wall autotile lookup; new tile renderers for
  doors and chests; decor pass between floor and actors.

- `render/sprites.ts` — new wall/weapon/door/chest/decor frame
  entries; `loadArmorAtlas()`; armor frame entries point at the
  secondary atlas.

- `content/items.json` — five new weapon entries.

- `content/itemLoader.ts` — depth-tier weighting for the larger weapon
  pool.

- `ui/sidePanel.ts` — equipment slot renders icons.

- `persistence/` — no changes needed; new tile values serialize via the
  existing `Uint8Array` path.

## Risks / known footguns

1. **Tile enum sprawl.** Going from 5 to 9 values touches every
   `switch (tile)` site. Mitigation: add a TypeScript exhaustiveness
   guard (`const _: never = tile`) in at least the `world.ts` floor
   pass and the `selectors.isPassable` switch so missed cases fail at
   compile time. Grep for `case Tile.` and verify each site handles
   the new values.

2. **Door bump as movement.** The natural shape for "move into closed
   door" is: reducer sees `DoorClosed` at the target, transitions it
   to `DoorOpen`, returns without committing the move. Next tick the
   actor re-issues intent and walks through. The risk is implementing
   it as "open and walk through in the same tick" — the door visually
   pops and the actor is past it before the player perceives the
   transition, which feels glitchy and breaks the bump-cost-a-turn
   contract.

3. **BSP connectivity through doors.** Procgen places corridors
   first, doors second. If the door scoring picks a corridor tile
   that's the *only* connection between two regions, the path still
   exists — closed doors don't disconnect graphs, they only delay
   traversal. AI pathing already handles arbitrary tile passability,
   so chase / wander work through a closed door (the AI bumps it
   open).

4. **Chest item duplication on resume.** A chest opens, the reducer
   emits the drop, but persistence saves between the tile transition
   and the drop append. Mitigation: the same reducer call must do
   both transitions atomically — open the chest tile and append the
   drop in one returned state. The reducer test asserts this.

5. **Autotile lookup gaps.** A missing entry in the 16-case table
   renders a black square. Mitigation: lookup returns `wall_mid` as
   the default, test asserts coverage of all 16 masks.

6. **Armor atlas missing.** Dev / CI environments without the new
   image fail to render armor icons. Mitigation: the sprite drawer
   falls back to the existing skull frame on load failure and logs
   once. Test environments use the fallback silently.

7. **Decoration inside FOV horizon.** A banner placed on a Floor tile
   adjacent to an unseen Wall could imply that wall's existence by
   appearing without context. Mitigation: decor visibility tracks its
   host tile's visibility (visible / seen / unknown). An unseen tile
   shows no decor, same as it shows no floor.

8. **Save schema.** Adding tile values 5–8 to `Tile` is forward-compatible
   for new saves, but a 1G save loaded into 1H sees only `Floor`,
   `Wall`, `Stairs`, `Shrine` — fine. A 1H save loaded into 1G would
   render unknown tiles as void. Acceptable: only one direction
   (forward) needs to work, since users don't downgrade.

## Out of scope (revisit later)

- Lockable doors that consume a key item.
- Mimic chests, trapped chests, golden chests with rare drops.
- Animated decorations (candle flame, wall fountains).
- Hero sprite varies per equipped weapon / armor.
- Multi-tile decor (statues, raised platforms).
- Boss-floor decoration set.
- More enemy archetypes from the unused 0x72 entries.
- Phase 1I — game-feel and UX (damage numbers, hit-stop, particles,
  tooltips, end-of-run summary, pause menu, first-run hints). Will
  get its own design once 1H ships.
