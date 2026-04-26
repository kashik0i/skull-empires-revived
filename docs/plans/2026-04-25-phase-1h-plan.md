# Phase 1H Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking. Waves run in parallel internally; serialize between waves. Each task ends in one commit.

**Goal:** Implement Phase 1H per `docs/plans/2026-04-25-phase-1h-design.md` — wall autotiling from unused 0x72 frames, doors (`Tile.DoorClosed`/`DoorOpen`), chests (`Tile.Chest`/`ChestOpen`), room decor pass, weapon pool 3→8, real armor sprites from a downloaded CC0 pack, and equipped-build sprite icons in the side panel.

**Architecture:** Foundational data first (Tile enum + walkability, items.json), then pure modules (wall autotile lookup, armor atlas loader), then reducer rules (door bump, chest open), then procgen passes (door / chest / decor placement), then render integration (world.ts), then HUD (equipment icons). Asset acquisition (armor.png) is its own late task — code falls back to the existing skull frame if the asset is missing, so nothing else blocks on it.

**Tech Stack:** Bun + Vite + TypeScript strict, existing reducer/render pattern, no new code deps. New runtime asset: one CC0 PNG.

**Working directory:** `.worktrees/phase-1h`
**Branch:** `feat/phase-1h`

**Conventions:**
- TDD for pure modules + reducers + procgen. Render glue gets a manual smoke pass at the end.
- Each task ends with `bun run typecheck` + relevant `bun test` + one commit.
- All paths relative to the worktree.
- World shape changes are forward-only (1G saves still load; 1H saves contain new tile values).

---

## Setup

### T0: Worktree

- [ ] **Step 1:** From `master` create the worktree + branch.

```bash
cd /home/amr/source/repos/kashik0i/skull-empires-revived
git worktree add .worktrees/phase-1h -b feat/phase-1h master
cd .worktrees/phase-1h
bun install
bun run typecheck
bun test
```

Expected: clean typecheck, all tests pass.

---

## Wave 1 — Foundations (serial — T1 unlocks the rest)

### T1: Tile enum extension + walkability

**Files:**
- Modify: `src/core/types.ts` (Tile object literal + `TileKind` type)
- Create: `src/core/tile.ts` (helpers `isPassable`, `isOpaque`)
- Create: `tests/core/tile.test.ts`

**Goal:** Add `DoorClosed`, `DoorOpen`, `Chest`, `ChestOpen` to the Tile enum, and centralise the passable / opaque predicates so move and FOV agree.

- [ ] **Step 1: Failing test.**

`tests/core/tile.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { Tile } from '../../src/core/types'
import { isPassable, isOpaque } from '../../src/core/tile'

describe('tile predicates', () => {
  it('passable: floor, stairs, shrine, open door, chest, open chest', () => {
    expect(isPassable(Tile.Floor)).toBe(true)
    expect(isPassable(Tile.Stairs)).toBe(true)
    expect(isPassable(Tile.Shrine)).toBe(true)
    expect(isPassable(Tile.DoorOpen)).toBe(true)
    expect(isPassable(Tile.Chest)).toBe(true)
    expect(isPassable(Tile.ChestOpen)).toBe(true)
  })

  it('not passable: void, wall, closed door', () => {
    expect(isPassable(Tile.Void)).toBe(false)
    expect(isPassable(Tile.Wall)).toBe(false)
    expect(isPassable(Tile.DoorClosed)).toBe(false)
  })

  it('opaque (blocks FOV): wall, closed door', () => {
    expect(isOpaque(Tile.Wall)).toBe(true)
    expect(isOpaque(Tile.DoorClosed)).toBe(true)
  })

  it('transparent (passes FOV): floor, stairs, shrine, open door, chests', () => {
    expect(isOpaque(Tile.Floor)).toBe(false)
    expect(isOpaque(Tile.Stairs)).toBe(false)
    expect(isOpaque(Tile.Shrine)).toBe(false)
    expect(isOpaque(Tile.DoorOpen)).toBe(false)
    expect(isOpaque(Tile.Chest)).toBe(false)
    expect(isOpaque(Tile.ChestOpen)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/core/tile.test.ts
```
Expected: FAIL (`Tile.DoorClosed` is undefined / `isPassable` not exported).

- [ ] **Step 3: Implement.**

`src/core/types.ts` — replace the Tile literal:
```ts
export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
  Stairs: 3,
  Shrine: 4,
  DoorClosed: 5,
  DoorOpen: 6,
  Chest: 7,
  ChestOpen: 8,
} as const
export type TileKind = (typeof Tile)[keyof typeof Tile]
```

`src/core/tile.ts` (new):
```ts
import { Tile, type TileKind } from './types'

export function isPassable(t: TileKind): boolean {
  switch (t) {
    case Tile.Floor:
    case Tile.Stairs:
    case Tile.Shrine:
    case Tile.DoorOpen:
    case Tile.Chest:
    case Tile.ChestOpen:
      return true
    case Tile.Void:
    case Tile.Wall:
    case Tile.DoorClosed:
      return false
  }
}

export function isOpaque(t: TileKind): boolean {
  switch (t) {
    case Tile.Wall:
    case Tile.DoorClosed:
      return true
    case Tile.Void:
    case Tile.Floor:
    case Tile.Stairs:
    case Tile.Shrine:
    case Tile.DoorOpen:
    case Tile.Chest:
    case Tile.ChestOpen:
      return false
  }
}
```

The exhaustive `switch` is intentional — TypeScript will fail compile if a new tile is added without a clause.

- [ ] **Step 4: Run, verify pass + typecheck.**

```bash
bun test tests/core/tile.test.ts
bun run typecheck
```
Expected: 4 tests pass; typecheck clean.

- [ ] **Step 5: Commit.**

```bash
git add src/core/types.ts src/core/tile.ts tests/core/tile.test.ts
git commit -m "feat(core): extend Tile with door + chest variants

Adds DoorClosed=5, DoorOpen=6, Chest=7, ChestOpen=8. Introduces
isPassable / isOpaque predicates with exhaustive switches so future
tile additions fail compile rather than silently render as void."
```

---

## Wave 2 — Pure modules (parallel-safe, 3 tasks)

### T2: Wall autotile lookup

**Files:**
- Create: `src/render/wallAutotile.ts`
- Create: `tests/render/wallAutotile.test.ts`

**Goal:** Pure function from a 4-bit cardinal-neighbor mask to a frame name. 16 cases. Safe `wall_mid` fallback.

- [ ] **Step 1: Failing test.**

`tests/render/wallAutotile.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { wallVariantForMask, NEIGHBOR_N, NEIGHBOR_E, NEIGHBOR_S, NEIGHBOR_W } from '../../src/render/wallAutotile'

describe('wallAutotile', () => {
  it('isolated wall (no neighbors) is a column piece', () => {
    expect(wallVariantForMask(0)).toBe('column_top')
  })

  it('fully surrounded wall renders as the inner brick', () => {
    expect(wallVariantForMask(NEIGHBOR_N | NEIGHBOR_E | NEIGHBOR_S | NEIGHBOR_W)).toBe('wall_mid')
  })

  it('only-S neighbor → top cap', () => {
    expect(wallVariantForMask(NEIGHBOR_S)).toBe('wall_top_mid')
  })

  it('top-left corner shape (E and S neighbors)', () => {
    expect(wallVariantForMask(NEIGHBOR_E | NEIGHBOR_S)).toBe('wall_corner_top_left')
  })

  it('top-right corner (W and S)', () => {
    expect(wallVariantForMask(NEIGHBOR_W | NEIGHBOR_S)).toBe('wall_corner_top_right')
  })

  it('left side (N and S)', () => {
    expect(wallVariantForMask(NEIGHBOR_N | NEIGHBOR_S)).toBe('wall_side_mid_left')
  })

  it('every 4-bit mask returns a defined string', () => {
    for (let m = 0; m < 16; m++) {
      const v = wallVariantForMask(m)
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/render/wallAutotile.test.ts
```
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement.**

`src/render/wallAutotile.ts`:
```ts
export const NEIGHBOR_N = 1 << 0
export const NEIGHBOR_E = 1 << 1
export const NEIGHBOR_S = 1 << 2
export const NEIGHBOR_W = 1 << 3

const TABLE: Record<number, string> = {
  // mask: NESW bits
  0b0000: 'column_top',         // isolated → pillar
  0b0001: 'wall_top_mid',       // only N → cap pointing up (we sit at top of column)
  0b0010: 'wall_side_mid_left', // only E → side, opens right
  0b0011: 'wall_corner_bottom_right',
  0b0100: 'wall_top_mid',       // only S → top cap
  0b0101: 'wall_side_mid_left', // N+S → vertical, treat as left side
  0b0110: 'wall_corner_top_left',
  0b0111: 'wall_side_mid_left',
  0b1000: 'wall_side_mid_right', // only W
  0b1001: 'wall_corner_bottom_left',
  0b1010: 'wall_top_mid',        // E+W horizontal
  0b1011: 'wall_top_mid',
  0b1100: 'wall_corner_top_right',
  0b1101: 'wall_side_mid_right',
  0b1110: 'wall_top_mid',
  0b1111: 'wall_mid',            // surrounded → inner
}

/**
 * Map a 4-bit cardinal-neighbor mask to a 0x72 wall frame name.
 * Bit layout: NEIGHBOR_N | NEIGHBOR_E | NEIGHBOR_S | NEIGHBOR_W.
 * A bit is set when that neighbor is also a wall (or out-of-bounds).
 * Falls back to 'wall_mid' on lookup gap.
 */
export function wallVariantForMask(mask: number): string {
  return TABLE[mask & 0b1111] ?? 'wall_mid'
}
```

Note: the table biases toward readable runs (vertical mask uses left-side; horizontal mask uses top-cap). The visual is approximate — pixel-art autotiling without a 256-entry table will always have a few "close enough" mappings. The test asserts coverage, not visual perfection.

- [ ] **Step 4: Run, verify pass + typecheck.**

```bash
bun test tests/render/wallAutotile.test.ts
bun run typecheck
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/render/wallAutotile.ts tests/render/wallAutotile.test.ts
git commit -m "feat(render): wall autotile lookup from 4-bit neighbor mask"
```

---

### T3: Items.json expansion + depth-tier pool

**Files:**
- Modify: `src/content/items.json` (add 5 weapons)
- Modify: `src/content/itemLoader.ts` (extend `itemPoolForDepth`)
- Modify: `tests/content/items.test.ts` (or create if absent)

**Goal:** Five new weapon entries + tiered pool placement. No code logic changes elsewhere.

- [ ] **Step 1: Failing test.**

Check `tests/content/` for an existing items test. If present, append; if absent, create `tests/content/items.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { getItemDef, itemPoolForDepth, listItemIds } from '../../src/content/itemLoader'

describe('items.json expansion', () => {
  it('contains the five new weapons', () => {
    const ids = listItemIds()
    for (const id of ['knight-blade', 'duel-blade', 'flame-blade', 'golden-blade', 'royal-blade']) {
      expect(ids).toContain(id)
    }
  })

  it('new weapons have correct atk values', () => {
    expect((getItemDef('knight-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(3)
    expect((getItemDef('duel-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(3)
    expect((getItemDef('flame-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(4)
    expect((getItemDef('golden-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(4)
    expect((getItemDef('royal-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(5)
  })

  it('depth pools are tiered (commons → mids → highs)', () => {
    const d1 = itemPoolForDepth(1)
    const d3 = itemPoolForDepth(3)
    const d5 = itemPoolForDepth(5)
    expect(d3.length).toBeGreaterThan(d1.length)
    expect(d5.length).toBeGreaterThan(d3.length)
    expect(d5).toContain('royal-blade')
    expect(d5).toContain('golden-blade')
    expect(d3).toContain('knight-blade')
  })

  it('existing item stats unchanged (regression)', () => {
    expect((getItemDef('rusty-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(1)
    expect((getItemDef('iron-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(2)
    expect((getItemDef('ember-blade').body as { kind: 'weapon'; atk: number }).atk).toBe(3)
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/content/items.test.ts
```
Expected: FAIL — new items missing.

- [ ] **Step 3: Implement — items.json.**

Append to `src/content/items.json` (the existing 10 entries stay):
```json
  ,{ "id": "knight-blade", "name": "Knight's Blade", "sprite": "weapon_knight_sword", "body": { "kind": "weapon", "atk": 3 } }
  ,{ "id": "duel-blade",   "name": "Duelist's Edge", "sprite": "weapon_duel_sword",   "body": { "kind": "weapon", "atk": 3 } }
  ,{ "id": "flame-blade",  "name": "Flame Edge",     "sprite": "weapon_anime_sword",  "body": { "kind": "weapon", "atk": 4 } }
  ,{ "id": "golden-blade", "name": "Golden Blade",   "sprite": "weapon_golden_sword", "body": { "kind": "weapon", "atk": 4 } }
  ,{ "id": "royal-blade",  "name": "Royal Sabre",    "sprite": "weapon_lavish_sword", "body": { "kind": "weapon", "atk": 5 } }
```
(Place inside the JSON array; remove the leading comma if you put them at the start, etc. Final file is a single valid JSON array of 15 entries.)

- [ ] **Step 4: Implement — itemLoader.**

In `src/content/itemLoader.ts`, replace `itemPoolForDepth`:
```ts
export function itemPoolForDepth(depth: number): readonly string[] {
  const commons = ['heal-small', 'rusty-blade', 'cloth-rags']
  const mids = [
    ...commons,
    'strength-tonic', 'iron-tonic', 'iron-blade', 'leather-vest',
    'knight-blade', 'duel-blade',
  ]
  const highs = [
    ...mids,
    'heal-large', 'ember-blade', 'plate-mail',
    'flame-blade', 'golden-blade', 'royal-blade',
  ]
  if (depth <= 2) return commons
  if (depth === 3) return mids
  return highs
}
```

- [ ] **Step 5: Run, verify pass + typecheck.**

```bash
bun test tests/content/items.test.ts
bun run typecheck
```
Expected: all 4 tests pass.

- [ ] **Step 6: Commit.**

```bash
git add src/content/items.json src/content/itemLoader.ts tests/content/items.test.ts
git commit -m "feat(content): expand weapon pool from 3 to 8

Adds knight-blade, duel-blade, flame-blade, golden-blade, royal-blade
with tiered depth weights. Existing items unchanged."
```

---

### T4: Sprite frame entries (walls + doors + chests + new weapons + decor)

**Files:**
- Modify: `src/render/sprites.ts` (extend `FRAMES` map)
- Create: `tests/render/sprites.test.ts` (or extend existing)

**Goal:** Register all the new frame names that later tasks reference. Pure data — no atlas image change.

The 0x72 atlas is a fixed image; frame coordinates are inferred from the atlas grid (mostly 16-pixel boundaries). The values below are best-effort from the canonical 0x72 layout; adjust during the smoke pass if any frame is visibly wrong.

- [ ] **Step 1: Failing test.**

`tests/render/sprites.test.ts` (extend or create):
```ts
import { describe, it, expect } from 'bun:test'
import { getFrame } from '../../src/render/sprites'

describe('sprite frames — phase 1H additions', () => {
  const newFrames = [
    'wall_corner_top_left', 'wall_corner_top_right',
    'wall_corner_bottom_left', 'wall_corner_bottom_right',
    'wall_side_mid_left', 'wall_side_mid_right',
    'wall_top_mid', 'column_top', 'column_mid',
    'door_closed', 'door_open',
    'chest_closed', 'chest_open',
    'wall_banner_red', 'wall_banner_blue', 'wall_banner_green', 'wall_banner_yellow',
    'crate', 'skull',
    'weapon_knight_sword', 'weapon_duel_sword', 'weapon_anime_sword',
    'weapon_golden_sword', 'weapon_lavish_sword',
  ]
  for (const name of newFrames) {
    it(`registers ${name}`, () => {
      const f = getFrame(name)
      expect(f).not.toBeNull()
      expect(f!.w).toBeGreaterThan(0)
      expect(f!.h).toBeGreaterThan(0)
    })
  }
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/render/sprites.test.ts
```
Expected: FAIL — frames missing.

- [ ] **Step 3: Implement.**

In `src/render/sprites.ts`, extend the `FRAMES` map. Add inside the existing `const FRAMES: Record<string, SpriteFrame>` literal, near the existing terrain block:
```ts
  // Wall variants (autotile)
  wall_corner_top_left:    { x: 16,  y: 16,  w: 16, h: 16, frames: 1 },
  wall_corner_top_right:   { x: 48,  y: 16,  w: 16, h: 16, frames: 1 },
  wall_corner_bottom_left: { x: 16,  y: 48,  w: 16, h: 16, frames: 1 },
  wall_corner_bottom_right:{ x: 48,  y: 48,  w: 16, h: 16, frames: 1 },
  wall_side_mid_left:      { x: 16,  y: 32,  w: 16, h: 16, frames: 1 },
  wall_side_mid_right:     { x: 48,  y: 32,  w: 16, h: 16, frames: 1 },
  wall_top_mid:            { x: 32,  y: 0,   w: 16, h: 16, frames: 1 },
  column_top:              { x: 96,  y: 16,  w: 16, h: 16, frames: 1 },
  column_mid:              { x: 96,  y: 32,  w: 16, h: 16, frames: 1 },

  // Doors
  door_closed:             { x: 16,  y: 224, w: 16, h: 16, frames: 1 },
  door_open:               { x: 32,  y: 224, w: 16, h: 16, frames: 1 },

  // Chests
  chest_closed:            { x: 304, y: 288, w: 16, h: 16, frames: 1 },
  chest_open:              { x: 336, y: 288, w: 16, h: 16, frames: 1 },

  // Decor
  wall_banner_red:         { x: 16,  y: 96,  w: 16, h: 16, frames: 1 },
  wall_banner_blue:        { x: 32,  y: 96,  w: 16, h: 16, frames: 1 },
  wall_banner_green:       { x: 48,  y: 96,  w: 16, h: 16, frames: 1 },
  wall_banner_yellow:      { x: 64,  y: 96,  w: 16, h: 16, frames: 1 },
  crate:                   { x: 288, y: 256, w: 16, h: 16, frames: 1 },
  skull:                   { x: 288, y: 320, w: 16, h: 16, frames: 1 },

  // New weapons
  weapon_knight_sword:     { x: 355, y: 26,  w: 10, h: 21, frames: 1 },
  weapon_duel_sword:       { x: 371, y: 26,  w: 10, h: 21, frames: 1 },
  weapon_anime_sword:      { x: 387, y: 26,  w: 10, h: 21, frames: 1 },
  weapon_golden_sword:     { x: 403, y: 26,  w: 10, h: 21, frames: 1 },
  weapon_lavish_sword:     { x: 419, y: 26,  w: 10, h: 21, frames: 1 },
```

- [ ] **Step 4: Run, verify pass + typecheck.**

```bash
bun test tests/render/sprites.test.ts
bun run typecheck
```
Expected: all new-frame tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/render/sprites.ts tests/render/sprites.test.ts
git commit -m "feat(render): register wall/door/chest/decor/weapon sprite frames"
```

---

## Wave 3 — Reducer + FOV semantics (parallel-safe, 3 tasks)

### T5: FOV uses `isOpaque` (closed doors block sight)

**Files:**
- Modify: `src/render/fov.ts`
- Create: `tests/render/fov.test.ts` (if not present; otherwise extend)

**Goal:** Replace the hardcoded `Tile.Wall` check with `isOpaque(tile)`. Closed doors now block FOV; open doors don't.

- [ ] **Step 1: Failing test.**

`tests/render/fov.test.ts` (create or extend):
```ts
import { describe, it, expect } from 'bun:test'
import { Tile, type Floor } from '../../src/core/types'
import { computeVisible } from '../../src/render/fov'

function makeFloor(w: number, h: number, fill: number = Tile.Floor): Floor {
  const tiles = new Uint8Array(w * h)
  tiles.fill(fill)
  return { width: w, height: h, tiles, spawns: [] }
}

describe('fov: doors', () => {
  it('closed door blocks line of sight to tiles beyond', () => {
    const f = makeFloor(7, 1)
    f.tiles[3] = Tile.DoorClosed
    const v = computeVisible(f, { x: 0, y: 0 })
    expect(v[3]).toBe(1)        // the closed door itself is visible (you see what blocks you)
    expect(v[4]).toBe(0)        // beyond the door — hidden
  })

  it('open door does NOT block line of sight', () => {
    const f = makeFloor(7, 1)
    f.tiles[3] = Tile.DoorOpen
    const v = computeVisible(f, { x: 0, y: 0 })
    expect(v[4]).toBe(1)
    expect(v[5]).toBe(1)
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/render/fov.test.ts
```
Expected: closed-door test fails (`computeVisible` only blocks on `Tile.Wall`).

- [ ] **Step 3: Implement.**

In `src/render/fov.ts`:
- Add import: `import { isOpaque } from '../core/tile'`
- In `hasLineOfSight`, replace:
  ```ts
  if (t === Tile.Wall) return false
  ```
  with:
  ```ts
  if (isOpaque(t)) return false
  ```

- [ ] **Step 4: Run, verify pass + typecheck.**

```bash
bun test tests/render/fov.test.ts
bun test tests/render/  # full render suite — make sure nothing else regressed
bun run typecheck
```
Expected: all FOV tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/render/fov.ts tests/render/fov.test.ts
git commit -m "feat(fov): closed doors block sight; open doors are transparent"
```

---

### T6: Move reducer — door bump + chest open

**Files:**
- Modify: `src/core/reducers/move.ts`
- Create: `tests/core/move-door.test.ts`
- Create: `tests/core/move-chest.test.ts`

**Goal:** When the hero (or any actor) tries to move into a closed door, transition the tile to `DoorOpen`, do not move, consume the turn. When the hero steps onto a closed chest, transition the tile to `ChestOpen` and append a `DroppedItemInstance` from the depth pool to the chest tile.

- [ ] **Step 1: Failing test — door.**

`tests/core/move-door.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { Tile } from '../../src/core/types'
import { moveActor } from '../../src/core/reducers/move'
import { createInitialWorld } from '../../src/core/state'

function withTile(state: ReturnType<typeof createInitialWorld>, x: number, y: number, t: number) {
  const tiles = new Uint8Array(state.floor.tiles)
  tiles[y * state.floor.width + x] = t
  return { ...state, floor: { ...state.floor, tiles } }
}

describe('move: doors', () => {
  it('bumping a closed door opens it and does NOT move the actor', () => {
    let s = createInitialWorld('door-test-1')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.DoorClosed)
    const before = s.actors[s.heroId].pos
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(before)        // didn't move
    expect(after.floor.tiles[target.y * after.floor.width + target.x]).toBe(Tile.DoorOpen)
  })

  it('walking into an open door moves through normally', () => {
    let s = createInitialWorld('door-test-2')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.DoorOpen)
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(target)
  })
})
```

- [ ] **Step 2: Failing test — chest.**

`tests/core/move-chest.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { Tile } from '../../src/core/types'
import { moveActor } from '../../src/core/reducers/move'
import { createInitialWorld } from '../../src/core/state'

function withTile(state: ReturnType<typeof createInitialWorld>, x: number, y: number, t: number) {
  const tiles = new Uint8Array(state.floor.tiles)
  tiles[y * state.floor.width + x] = t
  return { ...state, floor: { ...state.floor, tiles } }
}

describe('move: chests', () => {
  it('stepping on a closed chest opens it and drops one item on the same tile', () => {
    let s = createInitialWorld('chest-test-1')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.Chest)
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(target)
    expect(after.floor.tiles[target.y * after.floor.width + target.x]).toBe(Tile.ChestOpen)
    expect(after.groundItems.some(g => g.pos.x === target.x && g.pos.y === target.y)).toBe(true)
  })

  it('walking back over an open chest is a normal move (no double drop)', () => {
    let s = createInitialWorld('chest-test-2')
    const hero = s.actors[s.heroId]
    const target = { x: hero.pos.x + 1, y: hero.pos.y }
    s = withTile(s, target.x, target.y, Tile.ChestOpen)
    const before = s.groundItems.length
    const after = moveActor(s, { type: 'MoveActor', actorId: s.heroId, to: target })
    expect(after.actors[s.heroId].pos).toEqual(target)
    expect(after.groundItems.length).toBe(before)
  })
})
```

- [ ] **Step 3: Run, verify fail.**

```bash
bun test tests/core/move-door.test.ts tests/core/move-chest.test.ts
```
Expected: FAIL on both.

- [ ] **Step 4: Implement.**

In `src/core/reducers/move.ts`:

1. Add imports at the top:
```ts
import { isPassable } from '../tile'
import { itemPoolForDepth, instantiateItem } from '../../content/itemLoader'
import { nextU32 } from '../rng'
```

2. Replace the `isWalkable` helper with one that uses `isPassable`:
```ts
function isWalkable(state: World, p: Pos): boolean {
  const { floor } = state
  if (p.x < 0 || p.y < 0 || p.x >= floor.width || p.y >= floor.height) return false
  return isPassable(floor.tiles[p.y * floor.width + p.x])
}
```

3. At the top of `moveActor`, BEFORE `if (!isWalkable(...))`, insert door-bump logic:
```ts
  // Door bump: closed door → opens but does not move the actor.
  const targetIdx = action.to.y * state.floor.width + action.to.x
  if (state.floor.tiles[targetIdx] === Tile.DoorClosed) {
    const newTiles = new Uint8Array(state.floor.tiles)
    newTiles[targetIdx] = Tile.DoorOpen
    return {
      ...state,
      floor: { ...state.floor, tiles: newTiles },
    }
  }
```

4. At the END of `moveActor`, just before `return stateSoFar`, insert chest-open logic:
```ts
  // Chest open: stepping onto a closed chest opens it and drops an item
  // on the same tile. Hero only — enemies don't loot chests.
  if (actor.id === stateSoFar.heroId) {
    const idx = action.to.y * stateSoFar.floor.width + action.to.x
    if (stateSoFar.floor.tiles[idx] === Tile.Chest) {
      const tiles = new Uint8Array(stateSoFar.floor.tiles)
      tiles[idx] = Tile.ChestOpen
      const pool = itemPoolForDepth(stateSoFar.run.depth)
      const r = nextU32(stateSoFar.rng)
      const itemId = pool[r.value % pool.length]
      const instanceId = `chest-${stateSoFar.tick}-${idx}`
      stateSoFar = {
        ...stateSoFar,
        rng: r.state,
        floor: { ...stateSoFar.floor, tiles },
        groundItems: [
          ...stateSoFar.groundItems,
          { instanceId, itemId, pos: { x: action.to.x, y: action.to.y } },
        ],
      }
    }
  }
```

Note: the chest drop runs AFTER the existing ground-item pickup pass. Since the chest tile previously had no `groundItems` entry (chests aren't picked up like potions), there's no conflict — the drop is appended for a future step to collect.

- [ ] **Step 5: Run, verify pass + typecheck.**

```bash
bun test tests/core/
bun run typecheck
```
Expected: 4 new tests pass; no regressions in existing move/attack/turn tests.

- [ ] **Step 6: Commit.**

```bash
git add src/core/reducers/move.ts tests/core/move-door.test.ts tests/core/move-chest.test.ts
git commit -m "feat(core): door bump + chest open in move reducer

Closed doors transition to open on bump, consuming the actor's turn.
Closed chests transition to open on step-onto and append one
depth-tiered item drop to groundItems on the chest tile."
```

---

### T7: AI pathing respects new tile passability

**Files:**
- Modify: any AI pathing modules under `src/ai/` that use `Tile.Floor`/`Tile.Wall` directly
- Verify: `tests/ai/`

**Goal:** Ensure enemy chase / wander treat closed doors as blockers and open doors / chests as passable. Most AI code should already delegate to a passability check; this task is a sweep + small edit.

- [ ] **Step 1: Audit.**

```bash
grep -rn "Tile\." src/ai/ src/core/reducers/intent.ts
```

For each site:
- If it checks `tile === Tile.Floor`, replace with `isPassable(tile)` (importing from `../core/tile`).
- If it checks `tile === Tile.Wall`, replace with `!isPassable(tile)`.

Specifically expect to touch BFS / pathfinding. The hero auto-path code in `src/core/reducers/intent.ts` (or wherever path planning lives) likely also needs the same treatment.

- [ ] **Step 2: Failing test (regression-style).**

Add a single test confirming the AI pathfinder treats a closed door as blocked. If a suitable test file exists in `tests/ai/`, append; otherwise create `tests/ai/pathing-doors.test.ts`. Concrete fixture depends on the existing AI test conventions in the repo — match those rather than inventing new ones. If you can't easily craft a unit test, the existing AI tests passing after the edits below is sufficient regression cover.

- [ ] **Step 3: Implement.**

Apply the `isPassable` / `!isPassable` substitutions from Step 1.

- [ ] **Step 4: Run.**

```bash
bun test tests/ai/ tests/core/
bun run typecheck
```
Expected: no regressions.

- [ ] **Step 5: Commit.**

```bash
git add src/ai/ src/core/reducers/intent.ts tests/
git commit -m "refactor(ai): use isPassable for door/chest-aware pathing"
```

---

## Wave 4 — Procgen passes (parallel-safe, 3 tasks)

### T8: Door placement

**Files:**
- Modify: `src/procgen/floor.ts` (add door pass)
- Modify: `tests/procgen/floor.test.ts` (assertions for door count + placement)

**Goal:** After corridors are carved, identify corridor cells with exactly one cardinal neighbor that's a room interior — these are room-boundary cells and become door candidates. Place 1–2 closed doors per non-boss floor.

- [ ] **Step 1: Failing test.**

Append to `tests/procgen/floor.test.ts`:
```ts
describe('floor: doors', () => {
  it('places between 1 and 2 closed doors per floor', () => {
    const { floor } = generateFloor(createRng('door-1'), 40, 30)
    let count = 0
    for (let i = 0; i < floor.tiles.length; i++) {
      if (floor.tiles[i] === Tile.DoorClosed) count++
    }
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(2)
  })

  it('every door is reachable from a spawn (not in a sealed pocket)', () => {
    const { floor } = generateFloor(createRng('door-2'), 40, 30)
    // Spot-check: each door has at least one passable neighbor.
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (floor.tiles[y * floor.width + x] !== Tile.DoorClosed) continue
        const ns = [
          floor.tiles[(y - 1) * floor.width + x],
          floor.tiles[(y + 1) * floor.width + x],
          floor.tiles[y * floor.width + (x - 1)],
          floor.tiles[y * floor.width + (x + 1)],
        ]
        const passableNeighbors = ns.filter(t => t === Tile.Floor || t === Tile.Stairs).length
        expect(passableNeighbors).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/procgen/floor.test.ts
```
Expected: FAIL — no doors placed.

- [ ] **Step 3: Implement.**

In `src/procgen/floor.ts`, after the corridor-carving loop and before the scroll-placement scan, add the door pass.

The `generateBsp` result already gives us `rooms`. A door candidate is a tile that is currently `Floor` (because corridor was carved into wall) AND has exactly two `Floor` neighbors that face opposite directions (corridor passing between two floor tiles), AND at least one of those neighbors lies inside a room rect. Implement as:

```ts
  // Door pass: place 1-2 closed doors at corridor↔room boundaries.
  function inAnyRoom(x: number, y: number): boolean {
    for (const r of bsp.rooms) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true
    }
    return false
  }
  const doorCandidates: Pos[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y * width + x] !== Tile.Floor) continue
      if (inAnyRoom(x, y)) continue              // skip room interiors
      const left  = tiles[y * width + (x - 1)] === Tile.Floor
      const right = tiles[y * width + (x + 1)] === Tile.Floor
      const up    = tiles[(y - 1) * width + x] === Tile.Floor
      const down  = tiles[(y + 1) * width + x] === Tile.Floor
      const horiz = left && right && !up && !down
      const vert  = up && down && !left && !right
      if (!horiz && !vert) continue
      // At least one neighbor must be inside a room (we're at the boundary).
      const hasRoomNeighbor =
        (left && inAnyRoom(x - 1, y)) ||
        (right && inAnyRoom(x + 1, y)) ||
        (up && inAnyRoom(x, y - 1)) ||
        (down && inAnyRoom(x, y + 1))
      if (hasRoomNeighbor) doorCandidates.push({ x, y })
    }
  }
  if (doorCandidates.length > 0) {
    const targetCount = doorCandidates.length === 1 ? 1 : 2
    const picked = new Set<number>()
    while (picked.size < Math.min(targetCount, doorCandidates.length)) {
      const r = nextU32(rng)
      rng = r.state
      const idx = r.value % doorCandidates.length
      if (picked.has(idx)) continue
      picked.add(idx)
      const p = doorCandidates[idx]
      tiles[p.y * width + p.x] = Tile.DoorClosed
    }
  }
```

Note: the boss floor is generated by `boss.ts`, not `floor.ts`, so this pass naturally skips it. If `floor.ts` is also called with `hasStairs: false` for any other path, the door logic still runs but will simply find no candidates on a stairsless map — fine.

- [ ] **Step 4: Run, verify pass + typecheck.**

```bash
bun test tests/procgen/
bun run typecheck
```
Expected: door tests pass; existing floor tests still pass (the wall-neighbor regression test in `floor.test.ts` already includes `Tile.DoorClosed` in its valid set after Wave 1 — verify by running it; if it complains, extend `validTiles` to include the new variants).

- [ ] **Step 5: Update existing test if needed.**

If `floor.test.ts`'s "walls surround floor tiles" check rejects the new tile values, extend its `validTiles` array:
```ts
const validTiles: number[] = [
  Tile.Floor, Tile.Wall, Tile.Stairs, Tile.Shrine,
  Tile.DoorClosed, Tile.DoorOpen, Tile.Chest, Tile.ChestOpen,
]
```

- [ ] **Step 6: Commit.**

```bash
git add src/procgen/floor.ts tests/procgen/floor.test.ts
git commit -m "feat(procgen): place 1-2 closed doors per non-boss floor"
```

---

### T9: Chest placement

**Files:**
- Modify: `src/procgen/floor.ts`
- Modify: `tests/procgen/floor.test.ts`

**Goal:** Place exactly one closed chest per non-boss floor (when ≥3 rooms exist), in a room that is neither the spawn room nor the stairs room.

- [ ] **Step 1: Failing test.**

Append to `tests/procgen/floor.test.ts`:
```ts
describe('floor: chest', () => {
  it('places at most one closed chest per floor', () => {
    const { floor } = generateFloor(createRng('chest-1'), 40, 30)
    let count = 0
    for (let i = 0; i < floor.tiles.length; i++) {
      if (floor.tiles[i] === Tile.Chest) count++
    }
    expect(count).toBeLessThanOrEqual(1)
  })

  it('places exactly one chest when at least 3 rooms exist', () => {
    // Use a seed known to produce ≥3 rooms at this size — re-roll until we find one if needed.
    let { floor } = generateFloor(createRng('chest-2'), 40, 30)
    let count = 0
    for (let i = 0; i < floor.tiles.length; i++) {
      if (floor.tiles[i] === Tile.Chest) count++
    }
    expect(count).toBe(1)
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/procgen/
```

- [ ] **Step 3: Implement.**

In `src/procgen/floor.ts`, after stairs placement and after door placement, before the scroll candidate scan, add:
```ts
  // Chest pass: one per floor in a non-spawn, non-stairs room.
  if (bsp.rooms.length >= 3) {
    const stairsRoomIdx = hasStairs && bsp.rooms.length >= 2 ? bsp.rooms.length - 1 : -1
    const eligibleRooms = bsp.rooms
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => i !== stairsRoomIdx && i !== 0)  // 0 is hero-spawn room
    if (eligibleRooms.length > 0) {
      const r = nextU32(rng)
      rng = r.state
      const pick = eligibleRooms[r.value % eligibleRooms.length].r
      const cx = pick.x + Math.floor(pick.w / 2)
      const cy = pick.y + Math.floor(pick.h / 2)
      // Avoid overwriting spawns / stairs / doors / shrine.
      if (tiles[cy * width + cx] === Tile.Floor) {
        tiles[cy * width + cx] = Tile.Chest
      }
    }
  }
```

This must run AFTER door placement (so doors don't get overwritten) and AFTER stairs placement (already established).

- [ ] **Step 4: Update scroll/shrine candidate filters.**

The existing `candidates` scan at line ~50 in `floor.ts` filters `Tile.Floor` only — it already correctly excludes `Tile.Chest`. The shrine `if (shrineRoll.value < 0.25)` block reuses `candidates`, so it's also safe.

- [ ] **Step 5: Run, verify pass + typecheck.**

```bash
bun test tests/procgen/
bun run typecheck
```
Expected: chest tests pass; existing tests still pass.

- [ ] **Step 6: Commit.**

```bash
git add src/procgen/floor.ts tests/procgen/floor.test.ts
git commit -m "feat(procgen): place one closed chest per non-boss floor"
```

---

### T10: Decor pass

**Files:**
- Modify: `src/core/types.ts` (add optional `decor` to Floor)
- Modify: `src/procgen/floor.ts` (decor placement)
- Modify: `tests/procgen/floor.test.ts`

**Goal:** Generate 0–3 cosmetic props per room — banners on north walls, columns at corners, crates / skulls in interiors. Pure data; rendered later.

- [ ] **Step 1: Failing test.**

Append to `tests/procgen/floor.test.ts`:
```ts
describe('floor: decor', () => {
  it('attaches a decor array (possibly empty) to the floor', () => {
    const { floor } = generateFloor(createRng('decor-1'), 40, 30)
    expect(Array.isArray(floor.decor)).toBe(true)
  })

  it('decor positions are on Floor tiles, not on stairs/shrine/chest/door', () => {
    const { floor } = generateFloor(createRng('decor-2'), 40, 30)
    for (const d of floor.decor ?? []) {
      const t = floor.tiles[d.y * floor.width + d.x]
      expect(t).toBe(Tile.Floor)
    }
  })

  it('decor placement is deterministic for a fixed seed', () => {
    const a = generateFloor(createRng('decor-3'), 40, 30).floor.decor ?? []
    const b = generateFloor(createRng('decor-3'), 40, 30).floor.decor ?? []
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/procgen/
```
Expected: FAIL — `decor` is undefined.

- [ ] **Step 3: Implement — types.**

In `src/core/types.ts`, extend `Floor`:
```ts
export type FloorDecor = { x: number; y: number; sprite: string }

export type Floor = {
  width: number
  height: number
  tiles: Uint8Array
  spawns: Pos[]
  decor?: FloorDecor[]
}
```

- [ ] **Step 4: Implement — procgen.**

In `src/procgen/floor.ts`, after chest placement and before the final return, add:
```ts
  // Decor pass: 0-3 props per room, banners on north walls only.
  const DECOR_BANNERS = ['wall_banner_red', 'wall_banner_blue', 'wall_banner_green', 'wall_banner_yellow']
  const DECOR_FLOOR_PROPS = ['crate', 'skull', 'column_top']
  const decor: FloorDecor[] = []
  for (const room of bsp.rooms) {
    const propRoll = nextU32(rng)
    rng = propRoll.state
    const propCount = propRoll.value % 4   // 0, 1, 2, or 3
    for (let i = 0; i < propCount; i++) {
      const xRoll = nextU32(rng); rng = xRoll.state
      const yRoll = nextU32(rng); rng = yRoll.state
      const px = room.x + (xRoll.value % room.w)
      const py = room.y + (yRoll.value % room.h)
      if (tiles[py * width + px] !== Tile.Floor) continue
      // Choose banner if there is a wall to the north, else a floor prop.
      const northIsWall = py > 0 && tiles[(py - 1) * width + px] === Tile.Wall
      const kindRoll = nextU32(rng); rng = kindRoll.state
      const sprite = northIsWall
        ? DECOR_BANNERS[kindRoll.value % DECOR_BANNERS.length]
        : DECOR_FLOOR_PROPS[kindRoll.value % DECOR_FLOOR_PROPS.length]
      decor.push({ x: px, y: py, sprite })
    }
  }
```

Update the return object to include `decor`:
```ts
  return {
    floor: { width, height, tiles, spawns, decor },
    rng,
    scrollPos,
  }
```

Add `FloorDecor` to the import line at the top of `floor.ts`.

- [ ] **Step 5: Run, verify pass + typecheck.**

```bash
bun test tests/procgen/
bun run typecheck
```
Expected: decor tests pass.

- [ ] **Step 6: Commit.**

```bash
git add src/core/types.ts src/procgen/floor.ts tests/procgen/floor.test.ts
git commit -m "feat(procgen): cosmetic decor pass — banners, columns, crates"
```

---

## Wave 5 — Render integration (serial)

### T11: World renderer wires walls + doors + chests + decor

**Files:**
- Modify: `src/render/world.ts`

**Goal:** Render the new tile types and decor. Visual-only; no test changes.

- [ ] **Step 1: Apply edits.**

In `src/render/world.ts`:

1. Add imports:
```ts
import { wallVariantForMask, NEIGHBOR_N, NEIGHBOR_E, NEIGHBOR_S, NEIGHBOR_W } from './wallAutotile'
```

2. Helper for the wall mask (place near `tileVariantHash`):
```ts
function wallMaskAt(tiles: Uint8Array, w: number, h: number, x: number, y: number): number {
  let m = 0
  if (y === 0     || tiles[(y - 1) * w + x] === Tile.Wall) m |= NEIGHBOR_N
  if (x === w - 1 || tiles[y * w + (x + 1)] === Tile.Wall) m |= NEIGHBOR_E
  if (y === h - 1 || tiles[(y + 1) * w + x] === Tile.Wall) m |= NEIGHBOR_S
  if (x === 0     || tiles[y * w + (x - 1)] === Tile.Wall) m |= NEIGHBOR_W
  return m
}
```

3. In the per-tile switch / branch, replace the existing `Tile.Wall` rendering with autotile lookup, and add cases for the new tiles. Each case should match the existing pattern (atlas-ready vs procedural fallback). For brevity, after the existing `Tile.Floor` case:
```ts
      } else if (t === Tile.Wall) {
        if (atlasReady) {
          const mask = wallMaskAt(floor.tiles, floor.width, floor.height, x, y)
          const wallSprite = wallVariantForMask(mask)
          drawTileSprite(ctx, wallSprite, x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleDark
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
        }
      } else if (t === Tile.DoorClosed) {
        // Doors render on a floor base so the door piece doesn't sit on void.
        if (atlasReady) {
          drawTileSprite(ctx, 'floor_1', x, y, tileSize)
          drawTileSprite(ctx, 'door_closed', x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleLite
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
          ctx.fillStyle = palette.boneIvory
          ctx.fillRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8)
        }
      } else if (t === Tile.DoorOpen) {
        if (atlasReady) {
          drawTileSprite(ctx, 'floor_1', x, y, tileSize)
          drawTileSprite(ctx, 'door_open', x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleLite
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
        }
      } else if (t === Tile.Chest) {
        if (atlasReady) {
          drawTileSprite(ctx, 'floor_1', x, y, tileSize)
          drawTileSprite(ctx, 'chest_closed', x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleLite
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
          ctx.fillStyle = palette.bloodCrimson
          ctx.fillRect(x * tileSize + 6, y * tileSize + 8, tileSize - 12, tileSize - 16)
        }
      } else if (t === Tile.ChestOpen) {
        if (atlasReady) {
          drawTileSprite(ctx, 'floor_1', x, y, tileSize)
          drawTileSprite(ctx, 'chest_open', x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleLite
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
        }
      }
```

The exhaustive `Tile` switch adds no new branches beyond the four above — `Tile.Stairs` and `Tile.Shrine` already exist; keep them.

4. After the per-tile loop, BEFORE the actor pass, add a decor pass:
```ts
  // Decor pass — between floor and actors. Visibility tracks host tile.
  if (atlasReady && floor.decor && floor.decor.length > 0) {
    for (const d of floor.decor) {
      const idx = d.y * floor.width + d.x
      const vis = tileVisState(idx)
      if (vis === 'unknown') continue
      ctx.globalAlpha = vis === 'seen' ? 0.35 : 1
      drawTileSprite(ctx, d.sprite, d.x, d.y, tileSize)
    }
    ctx.globalAlpha = 1
  }
```

- [ ] **Step 2: Typecheck.**

```bash
bun run typecheck
```
Expected: clean.

- [ ] **Step 3: Manual smoke (browser).**

```bash
bun run dev
```
Open http://localhost:5173/?dev=1 and check:
- Walls: corners and edges differ from the old uniform brick.
- Doors: 1–2 closed doors visible at corridor-room boundaries; bumping into one opens it (see `door_open` frame).
- Chest: one closed chest in a room; stepping onto it opens and a flask/sword sprite appears on the same tile.
- Decor: banners, crates, skulls, columns visible in rooms.

If a sprite frame looks visibly wrong (e.g. wrong piece for `door_closed`), open `src/render/sprites.ts` and adjust the `x`/`y` for that frame to land on the correct atlas region. The 0x72 atlas is 512×512; frames are on 16-pixel grid lines for terrain.

- [ ] **Step 4: Commit.**

```bash
git add src/render/world.ts
git commit -m "feat(render): wall autotile, doors, chests, decor"
```

---

### T12: Armor atlas loader (code only — works without the asset)

**Files:**
- Modify: `src/render/sprites.ts` (add second atlas loader, route armor frames there)
- Modify: `src/main.ts` (call `loadArmorAtlas()` at boot)
- Create: `tests/render/spritesArmor.test.ts`

**Goal:** Add a second-atlas plumbing path. Armor frames point into the new atlas, but if the asset is missing the renderer falls back to the existing skull placeholder. Ships green even before T13 lands the actual file.

- [ ] **Step 1: Failing test.**

`tests/render/spritesArmor.test.ts`:
```ts
import { describe, it, expect } from 'bun:test'
import { getFrame } from '../../src/render/sprites'

describe('armor frames', () => {
  it('armor_cloth, armor_leather, armor_plate are registered', () => {
    expect(getFrame('armor_cloth')).not.toBeNull()
    expect(getFrame('armor_leather')).not.toBeNull()
    expect(getFrame('armor_plate')).not.toBeNull()
  })

  it('the three armor frames have distinct horizontal offsets in the same atlas', () => {
    const a = getFrame('armor_cloth')!
    const b = getFrame('armor_leather')!
    const c = getFrame('armor_plate')!
    expect(a.x).not.toBe(b.x)
    expect(b.x).not.toBe(c.x)
    expect(a.w).toBe(16)
    expect(b.w).toBe(16)
    expect(c.w).toBe(16)
  })
})
```

- [ ] **Step 2: Run, verify fail.**

```bash
bun test tests/render/spritesArmor.test.ts
```
Expected: FAIL — armor frames currently all share the skull's coords.

- [ ] **Step 3: Implement.**

In `src/render/sprites.ts`:

1. Replace the three armor entries with offsets into the new armor atlas (frame coords for `armor.png` 48×16):
```ts
  // Armor — sourced from public/sprites/armor.png (48x16, 3 frames)
  armor_cloth:    { x: 0,  y: 0, w: 16, h: 16, frames: 1 },
  armor_leather:  { x: 16, y: 0, w: 16, h: 16, frames: 1 },
  armor_plate:    { x: 32, y: 0, w: 16, h: 16, frames: 1 },
```

2. Add a second image loader and a frame→atlas router. Just below the existing `loadAtlas`:
```ts
let armorAtlas: HTMLImageElement | null = null
let armorPromise: Promise<HTMLImageElement> | null = null

export function loadArmorAtlas(src = '/sprites/armor.png'): Promise<HTMLImageElement | null> {
  if (armorAtlas) return Promise.resolve(armorAtlas)
  if (armorPromise) return armorPromise
  armorPromise = new Promise((resolve) => {
    const img = new Image()
    img.onload = () => { armorAtlas = img; resolve(img) }
    img.onerror = () => {
      console.warn('[sprites] armor.png missing — falling back to skull placeholder')
      resolve(null)
    }
    img.src = src
  })
  return armorPromise
}

function atlasForFrame(name: string): HTMLImageElement | null {
  if (name.startsWith('armor_') && armorAtlas) return armorAtlas
  return atlas
}
```

3. In `drawSprite` and `drawTileSprite`, replace `if (!atlas) return false` and the `ctx.drawImage(atlas, ...)` calls with the routed atlas:
```ts
  const img = atlasForFrame(name)
  if (!img) {
    // Armor fallback path: re-route to skull frame on the dungeon atlas.
    if (name.startsWith('armor_') && atlas) {
      return drawSprite(ctx, 'skull', cx, cy, tileSize, nowMs, flipX)
    }
    return false
  }
  // ... use `img` instead of `atlas` in the drawImage calls
```

(Apply the same routing change to `drawTileSprite`.)

4. In `src/main.ts`, alongside the existing `loadAtlas()` call at boot, fire-and-forget the armor atlas:
```ts
loadAtlas().catch(() => {})
loadArmorAtlas().catch(() => {})
```
(Keep the existing one. Add an import for `loadArmorAtlas`.)

- [ ] **Step 4: Run, verify pass + typecheck.**

```bash
bun test tests/render/
bun run typecheck
```
Expected: armor-frame tests pass; no regressions in existing render tests.

- [ ] **Step 5: Commit.**

```bash
git add src/render/sprites.ts src/main.ts tests/render/spritesArmor.test.ts
git commit -m "feat(render): armor atlas loader with skull fallback

Routes armor_* frames to public/sprites/armor.png if present, else
falls back to the existing skull frame so the game still ships if
the asset is missing."
```

---

### T13: Source + integrate `armor.png`

**Files:**
- Create: `public/sprites/armor.png` (48×16 PNG, 3 frames)
- Modify: `public/sprites/ATLAS_ATTRIBUTION.txt`

**Goal:** Drop the actual asset into the project. After this task, the equipped-armor icons show real artwork instead of the skull fallback.

- [ ] **Step 1: Source the sprites.**

Primary source: **DawnLike** (public domain) by DragonDePlatino.
- Github mirror with the sprites: https://github.com/jonbro/DawnLike (or another mirror)
- Files of interest: `Items/ShortWear.png` and `Items/MidWear.png` and `Items/LongWear.png` — pick one frame from each that reads as cloth / leather / plate.

Backup source: **Kenney Tiny Dungeon** (CC0).
- https://kenney.nl/assets/tiny-dungeon — download the pack and pull three armor-like icons from `Tiles/`.

If neither source is reachable in the working environment (network sandbox), STOP this task, leave the skull fallback in place, and surface a request to the user: "Drop a 48×16 PNG with three 16×16 armor frames (cloth/leather/plate) at `public/sprites/armor.png` and re-run the smoke checklist."

- [ ] **Step 2: Pack into 48×16 PNG.**

Compose a single PNG `public/sprites/armor.png`:
- Dimensions: 48×16
- Frame 0 (x=0): cloth tunic
- Frame 1 (x=16): leather vest
- Frame 2 (x=32): plate cuirass
- Background: transparent

ImageMagick one-liner if you have three separate 16×16 PNGs `cloth.png`, `leather.png`, `plate.png`:
```bash
magick cloth.png leather.png plate.png +append public/sprites/armor.png
```

- [ ] **Step 3: Update attribution.**

Append to `public/sprites/ATLAS_ATTRIBUTION.txt`:
```
Armor sprites (armor.png) by <pack author> — <license, URL>
```

- [ ] **Step 4: Smoke check.**

```bash
bun run dev
```
Equip cloth / leather / plate items in turn. The HUD equipment slot (after T14) should show three distinct armor icons.

- [ ] **Step 5: Commit.**

```bash
git add public/sprites/armor.png public/sprites/ATLAS_ATTRIBUTION.txt
git commit -m "assets: armor sprites from <source pack>

48x16 PNG, three 16x16 frames (cloth/leather/plate). Fallback path
still works if asset is removed."
```

---

### T14: Side panel equipment slot — sprite icons

**Files:**
- Modify: `src/ui/sidePanel.ts` or wherever the equipment slot is mounted (grep for `slot('equipment')`)
- Or: `src/ui/equipmentPanel.ts` if it exists

**Goal:** Each equipment line gets a 32×32 canvas sprite icon to the left of the text, sourced via the existing `drawSprite` path.

- [ ] **Step 1: Locate the existing equipment-slot renderer.**

```bash
grep -rn "slot('equipment')" src/
grep -rn "equipment" src/ui/
```

Open the file that renders the slot's contents.

- [ ] **Step 2: Add icon rendering.**

For each equipment line (weapon, armor), replace the text-only DOM with a `flex` row containing a `<canvas>` icon and the existing text node:

```ts
// Helper at module scope
function makeEquipmentIcon(spriteName: string | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  canvas.style.imageRendering = 'pixelated'
  const ctx = canvas.getContext('2d')
  if (ctx && spriteName) {
    // Draw at 2x scale; centered. drawSprite anchors bottom-middle, so use tileSize=32 here.
    ctx.imageSmoothingEnabled = false
    drawSprite(ctx, spriteName, 16, 16, 32)
  } else if (ctx) {
    // Empty-slot placeholder: faded outline.
    ctx.strokeStyle = 'rgba(234, 219, 192, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(4, 4, 24, 24)
  }
  return canvas
}
```

(Import `drawSprite` from `../render/sprites` if not already.)

When rendering the row, replace the prior text-only node with:
```ts
const row = document.createElement('div')
row.style.display = 'flex'
row.style.alignItems = 'center'
row.style.gap = '8px'
row.appendChild(makeEquipmentIcon(item ? item.sprite : null))
const label = document.createElement('span')
label.textContent = item ? `${item.name} (+${stat})` : '— empty —'
row.appendChild(label)
```

(`stat` is `(item.body as { atk?: number; def?: number }).atk ?? def` depending on slot.)

The slot already updates on equip/unequip events; rebuilding the inner DOM on each update is fine — the slot is not in the per-frame render path.

- [ ] **Step 3: Typecheck + smoke.**

```bash
bun run typecheck
bun run dev
```

Equip a weapon. Confirm:
- The equipment slot shows a 32×32 sword icon next to the weapon name.
- Equip armor. Either real armor sprite (T13 done) or the skull fallback shows.
- Empty slot shows a faded outline rectangle.

- [ ] **Step 4: Commit.**

```bash
git add src/ui/  # whatever file(s) changed
git commit -m "feat(ui): equipment slot renders sprite icons next to text"
```

---

### T15: Smoke checklist + persistence regression

**Files:**
- Create: `docs/SMOKE-PHASE-1H.md` (mirror the structure of `docs/SMOKE-PHASE-1G.md`)

**Goal:** Catch integration issues no unit test will. Includes a persistence round-trip via the auto-resume path, since new tile values must serialize.

- [ ] **Step 1: Write the smoke checklist.**

`docs/SMOKE-PHASE-1H.md`:
```markdown
# Phase 1H smoke checklist

Date: 2026-04-25

## Walls
- [ ] Floors look like rooms with corners and edges, not flat brick rectangles.
- [ ] No black squares where wall variants are missing.

## Doors
- [ ] 1-2 closed doors visible on each non-boss floor.
- [ ] Bumping a closed door opens it; hero stays in place that turn; next click moves through.
- [ ] Closed doors block FOV — tiles past the door are dark until you open it.
- [ ] Open doors are passable and transparent for FOV.
- [ ] Refresh mid-floor with an opened door → door is still open after auto-resume.

## Chests
- [ ] One closed chest visible on most non-boss floors.
- [ ] Stepping onto the chest opens it and a flask/weapon/armor sprite appears on the tile.
- [ ] Walking off and back onto the open chest does NOT spawn a second drop.
- [ ] Pickup of the chest drop works the same as enemy drops.

## Decor
- [ ] Banners hang from north walls (not in the middle of rooms).
- [ ] Crates / skulls / columns appear in interior tiles, never on stairs / shrine / chest / door / scroll.
- [ ] Same seed produces the same decor on reload.

## Weapons
- [ ] Floor 1-2 drops feel "common-tier" (rusty/iron).
- [ ] Floor 4-5 drops include the new high-tier blades.

## Armor
- [ ] Cloth/leather/plate icons render in inventory + equipment slot.
- [ ] If `public/sprites/armor.png` is missing, equipment slot shows skull fallback (no crash).
- [ ] Equipping armor updates the HUD ATK/DEF readout.

## Build display
- [ ] Equipment slot shows a 32×32 weapon icon + name + +stat.
- [ ] Empty slot shows a faded outline placeholder.

## Persistence
- [ ] Refresh during a run with a closed door + open door + open chest. After auto-resume, all three render the same.

## Regressions (1G)
- [ ] Camera deadzone + smooth follow still feel right.
- [ ] Zoom keys + Ctrl-wheel + panel buttons still work.
- [ ] Dev menu button still toggles via panel + backtick.
- [ ] Replay from URL still loads.
```

- [ ] **Step 2: Run through the checklist manually.**

Mark each item ✓ or note issues. If anything fails, fix in the relevant earlier task's commit (don't let smoke regressions slip into "follow-up").

- [ ] **Step 3: Final test pass.**

```bash
bun test
bun run typecheck
bun run build
```
Expected: all green.

- [ ] **Step 4: Commit + ready-to-merge.**

```bash
git add docs/SMOKE-PHASE-1H.md
git commit -m "docs(phase-1h): smoke checklist"
git push -u origin feat/phase-1h
```

Then open a PR titled "Phase 1H — World, sprites & build display" linking the design + plan docs.

---

## Self-review notes

- Spec coverage: every section of the design spec maps to a task (autotile=T2, doors=T1+T5+T6+T8+T11, chests=T1+T6+T9+T11, decor=T10+T11, weapons=T3+T4, armor sprites=T12+T13, build HUD=T14, smoke=T15).
- No placeholders: T13 does specify a download step that may need user help if the network sandbox blocks the source — the fallback path through T12 keeps the rest shippable.
- Type consistency: `Tile.DoorClosed` / `DoorOpen` / `Chest` / `ChestOpen` are used uniformly across reducer, FOV, procgen, and renderer. `FloorDecor` is the type name in both `types.ts` and `floor.ts`.
- Frame coordinates in T4 are best-effort from the canonical 0x72 layout; the smoke step in T11 explicitly says to fix them if they look wrong, which is the right tradeoff vs grinding the implementer through pixel-measurement up front.
