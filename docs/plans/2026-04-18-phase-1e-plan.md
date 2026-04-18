# Phase 1E Implementation Plan

> **Executor:** subagent-driven-development. Waves run in parallel internally; serialize between waves. Each task ends in one commit.

**Goal:** Implement Phase 1E per `docs/plans/2026-04-18-phase-1e-design.md` — replace cards with inventory + equipment + potions, add tile/character sprite variety, add procedural ambient music.

**Architecture:** Build the inventory system additive to the existing card system (cards keep working). Migrate merchant + floor reward to items. Then delete the card system entirely. Music is a self-contained module wired in `main.ts`. Schema bump auto-wipes old saves.

**Tech Stack:** Bun + Vite + TypeScript strict, existing reducer/selector pattern, Web Audio API (no new deps).

**Working directory:** `.worktrees/phase-1e`
**Branch:** `feat/phase-1e`

**Conventions:**
- TDD where pure (reducers, selectors, loaders). DOM glue + render skip unit tests; runtime smoke at end.
- Each task ends with `bun run typecheck` + relevant `bun test` + commit.
- All paths relative to the worktree.

---

## Wave 1 — Foundation (serial, 4 tasks)

### T1: Item / Equipment types + World additions

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/state.ts`

**Changes to `types.ts`:**
- Add types:
  ```ts
  export type EquipmentSlot = 'weapon' | 'armor'

  export type ItemKind =
    | { kind: 'potion'; effect: PotionEffect }
    | { kind: 'weapon'; atk: number }
    | { kind: 'armor'; def: number }

  export type PotionEffect =
    | { type: 'heal'; amount: number }
    | { type: 'buff-atk'; amount: number; durationTicks: number }
    | { type: 'buff-def'; amount: number; durationTicks: number }

  export type Item = {
    id: string          // item type id, e.g. 'heal-small'
    instanceId: string  // unique per spawned instance
    name: string
    sprite: string
    body: ItemKind
  }

  export type DroppedItemInstance = {
    instanceId: string
    itemId: string
    pos: Pos
  }
  ```
- Add fields on `World`:
  ```ts
  inventory: Item[]
  equipment: { weapon: Item | null; armor: Item | null }
  groundItems: DroppedItemInstance[]
  ```
- Add new `Action` variants:
  ```ts
  | { type: 'UseItem'; instanceId: string }
  | { type: 'EquipItem'; instanceId: string }
  | { type: 'UnequipItem'; slot: EquipmentSlot }
  | { type: 'PickupItem'; instanceId: string }
  | { type: 'OfferItemReward'; itemIds: string[] }
  | { type: 'PickItemReward'; itemId: string }
  | { type: 'MerchantBuyItem'; itemId: string; merchantId: ActorId }
  ```
- Do NOT remove existing card types yet — they stay until T14.

**Changes to `state.ts`:** in `createInitialWorld`, add to the returned World:
```ts
inventory: [],
equipment: { weapon: null, armor: null },
groundItems: [],
```

**Verification:**

- [ ] **Step 1: Apply edits.**

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean. Test fixtures with manual `World` literals will need `inventory: []`, `equipment: { weapon: null, armor: null }`, `groundItems: []`. Grep `tests/` for `run: {` to find them.

- [ ] **Step 3: Full suite.**
Run: `bun test`
Expected: all green (~194 still pass; no behavior change).

- [ ] **Step 4: Commit.**
```bash
git add src/core/types.ts src/core/state.ts tests/
git commit -m "feat(core): phase 1e types — item, equipment, inventory, ground items"
```

---

### T2: Schema bump + auto-wipe on mismatch

**Files:**
- Modify: `src/persistence/db/schema.sql`
- Modify: `src/persistence/db/worker.ts`

**Goal:** Bump the persistence schema so old Phase 1D saves are auto-wiped (no migration shim).

**Changes to `schema.sql`:** add a `meta` table for version tracking, then keep the existing `runs` and `events` tables unchanged. Insert the version row idempotently:

```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '2');
```

**Changes to `worker.ts`:** add a constant `SCHEMA_VERSION = '2'`. Before applying the schema SQL, query the existing `meta` table (wrap in try/catch — first boot won't have it). If the stored version differs from the constant, drop both `events` and `runs` tables (and `meta`) so the fresh schema can be applied. Log a single info line `[persistence] schema upgrade <old> → 2; previous runs wiped`.

The existing worker uses sqlite-wasm's database query API (`db.run`, `db.get`, etc.) — match whatever helpers are already in use rather than introducing new ones.

**Tests:** none (worker is hard to unit-test). Smoke verification only.

**Verification:**

- [ ] **Step 1: Apply edits.**
- [ ] **Step 2: `bun test && bun run typecheck` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add src/persistence/db/schema.sql src/persistence/db/worker.ts
git commit -m "feat(persistence): schema v2 + auto-wipe on version mismatch"
```

---

### T3: Item content + loader

**Files:**
- Create: `src/content/items.json`
- Create: `src/content/itemLoader.ts`
- Create: `tests/content/itemLoader.test.ts`

**`items.json`:**
```json
[
  { "id": "heal-small",      "name": "Lesser Vial",   "sprite": "flask_red",          "body": { "kind": "potion", "effect": { "type": "heal", "amount": 5 } } },
  { "id": "heal-large",      "name": "Greater Vial",  "sprite": "flask_big_red",      "body": { "kind": "potion", "effect": { "type": "heal", "amount": 12 } } },
  { "id": "strength-tonic",  "name": "Strength Tonic","sprite": "flask_yellow",       "body": { "kind": "potion", "effect": { "type": "buff-atk", "amount": 2, "durationTicks": 5 } } },
  { "id": "iron-tonic",      "name": "Iron Tonic",    "sprite": "flask_blue",         "body": { "kind": "potion", "effect": { "type": "buff-def", "amount": 2, "durationTicks": 5 } } },
  { "id": "rusty-blade",     "name": "Rusty Blade",   "sprite": "weapon_rusty_sword", "body": { "kind": "weapon", "atk": 1 } },
  { "id": "iron-blade",      "name": "Iron Blade",    "sprite": "weapon_regular_sword","body": { "kind": "weapon", "atk": 2 } },
  { "id": "ember-blade",     "name": "Ember Blade",   "sprite": "weapon_red_gem_sword","body": { "kind": "weapon", "atk": 3 } },
  { "id": "cloth-rags",      "name": "Cloth Rags",    "sprite": "armor_cloth",        "body": { "kind": "armor",  "def": 1 } },
  { "id": "leather-vest",    "name": "Leather Vest",  "sprite": "armor_leather",      "body": { "kind": "armor",  "def": 2 } },
  { "id": "plate-mail",      "name": "Plate Mail",    "sprite": "armor_plate",        "body": { "kind": "armor",  "def": 3 } }
]
```

(Sprite names are best-guess from the 0x72 atlas; T6 verifies real names against `public/sprites/ATLAS_ATTRIBUTION.txt` and adjusts both files together.)

**`itemLoader.ts`:**
```ts
import raw from './items.json'
import type { Item } from '../core/types'

type ItemDef = Omit<Item, 'instanceId'>

const defs: readonly ItemDef[] = raw as readonly ItemDef[]
const byId: Record<string, ItemDef> = Object.fromEntries(defs.map(d => [d.id, d]))

export function getItemDef(id: string): ItemDef {
  const d = byId[id]
  if (!d) throw new Error(`unknown item id: ${id}`)
  return d
}

export function listItemIds(): readonly string[] {
  return defs.map(d => d.id)
}

/** Build an Item with a fresh instanceId. */
export function instantiateItem(id: string, instanceId: string): Item {
  return { ...getItemDef(id), instanceId }
}

/** Depth-tier pool: floor 1-2 commons; 3 mids; 4-5 highs. */
export function itemPoolForDepth(depth: number): readonly string[] {
  const commons = ['heal-small', 'rusty-blade', 'cloth-rags']
  const mids = [...commons, 'strength-tonic', 'iron-tonic', 'iron-blade', 'leather-vest']
  const highs = [...mids, 'heal-large', 'ember-blade', 'plate-mail']
  if (depth <= 2) return commons
  if (depth === 3) return mids
  return highs
}
```

**Tests — `tests/content/itemLoader.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { getItemDef, listItemIds, instantiateItem, itemPoolForDepth } from '../../src/content/itemLoader'

describe('itemLoader', () => {
  it('lists exactly 10 items', () => {
    expect(listItemIds().length).toBe(10)
  })

  it('throws on unknown id', () => {
    expect(() => getItemDef('does-not-exist')).toThrow()
  })

  it('instantiates with given instanceId', () => {
    const it = instantiateItem('heal-small', 'inst-1')
    expect(it.instanceId).toBe('inst-1')
    expect(it.id).toBe('heal-small')
    expect(it.body.kind).toBe('potion')
  })

  it('depth pool grows with depth', () => {
    expect(itemPoolForDepth(1).length).toBe(3)
    expect(itemPoolForDepth(3).length).toBe(7)
    expect(itemPoolForDepth(5).length).toBe(10)
  })
})
```

**Verification:**

- [ ] **Step 1: Write files + tests.**
- [ ] **Step 2: `bun test tests/content/itemLoader.test.ts` → 4 pass.**
- [ ] **Step 3: `bun test && bun run typecheck` → all green.**
- [ ] **Step 4: Commit.**
```bash
git add src/content/items.json src/content/itemLoader.ts tests/content/itemLoader.test.ts
git commit -m "feat(content): 10-item catalogue (potions/weapons/armor) + depth pool"
```

---

### T4: Effective stats selectors

**Files:**
- Modify: `src/core/selectors.ts`
- Create: `tests/core/selectors-effective.test.ts`

**Selectors to add:**
```ts
import type { World, ActorId } from './types'

export function effectiveAtk(state: World, actorId: ActorId): number {
  const actor = state.actors[actorId]
  if (!actor) return 0
  let total = actor.atk
  if (actorId === state.heroId && state.equipment.weapon?.body.kind === 'weapon') {
    total += state.equipment.weapon.body.atk
  }
  for (const e of actor.statusEffects) {
    if (e.kind === 'buff-atk') total += e.amount
  }
  return total
}

export function effectiveDef(state: World, actorId: ActorId): number {
  const actor = state.actors[actorId]
  if (!actor) return 0
  let total = actor.def
  if (actorId === state.heroId && state.equipment.armor?.body.kind === 'armor') {
    total += state.equipment.armor.body.def
  }
  for (const e of actor.statusEffects) {
    if (e.kind === 'buff-def') total += e.amount
  }
  return total
}
```

**Tests:**
```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../src/core/state'
import { effectiveAtk, effectiveDef } from '../../src/core/selectors'
import { instantiateItem } from '../../src/content/itemLoader'

describe('effective stats', () => {
  it('returns base atk/def with no equipment + no buffs', () => {
    const w = createInitialWorld('eff-1')
    const hero = w.actors[w.heroId]
    expect(effectiveAtk(w, w.heroId)).toBe(hero.atk)
    expect(effectiveDef(w, w.heroId)).toBe(hero.def)
  })

  it('adds weapon atk to hero when equipped', () => {
    const base = createInitialWorld('eff-2')
    const w = { ...base, equipment: { weapon: instantiateItem('iron-blade', 'w1'), armor: null } }
    expect(effectiveAtk(w, w.heroId)).toBe(base.actors[base.heroId].atk + 2)
  })

  it('adds armor def to hero when equipped', () => {
    const base = createInitialWorld('eff-3')
    const w = { ...base, equipment: { weapon: null, armor: instantiateItem('plate-mail', 'a1') } }
    expect(effectiveDef(w, w.heroId)).toBe(base.actors[base.heroId].def + 3)
  })

  it('adds buff-atk status', () => {
    const base = createInitialWorld('eff-4')
    const hero = base.actors[base.heroId]
    const buffed = { ...hero, statusEffects: [{ kind: 'buff-atk' as const, amount: 3, remainingTicks: 2 }] }
    const w = { ...base, actors: { ...base.actors, [base.heroId]: buffed } }
    expect(effectiveAtk(w, w.heroId)).toBe(hero.atk + 3)
  })

  it('does not add hero equipment to enemies', () => {
    const base = createInitialWorld('eff-5')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const w = { ...base, equipment: { weapon: instantiateItem('ember-blade', 'w2'), armor: null } }
    expect(effectiveAtk(w, enemyId)).toBe(base.actors[enemyId].atk)
  })
})
```

**Verification:**

- [ ] **Step 1: Implement + test.**
- [ ] **Step 2: `bun test tests/core/selectors-effective.test.ts` → 5 pass.**
- [ ] **Step 3: `bun test && bun run typecheck` → all green.**
- [ ] **Step 4: Commit.**
```bash
git add src/core/selectors.ts tests/core/selectors-effective.test.ts
git commit -m "feat(core): effectiveAtk / effectiveDef selectors fold equipment + buffs"
```

---

## Wave 2 — Content + visuals (parallel via sub-worktrees, 4 tasks)

### T5: New character archetypes

**Files:**
- Modify: `src/content/archetypes.json`
- Modify: `src/render/sprites.ts` (character frames)
- Modify: `src/core/state.ts` (FLOOR_COMPOSITIONS — add new enemies)

**Add to `archetypes.json`** (verify sprite coords against `public/sprites/ATLAS_ATTRIBUTION.txt`):
```json
"chort": {
  "kind": "enemy",
  "name": "Chort",
  "hp": 6, "atk": 2, "def": 0,
  "color": "bloodCrimson",
  "sprite": "chort_idle",
  "shape": { "body": { "type": "rect", "w": 0.55, "h": 0.7, "color": "bloodCrimson", "corner": 0.1 }, "head": { "type": "circle", "y": -0.35, "r": 0.2, "color": "bloodCrimson" }, "eyes": { "type": "eyeDots", "y": -0.35, "spacing": 0.1, "r": 0.04, "color": "boneWhite" } }
},
"wogol": {
  "kind": "enemy",
  "name": "Wogol",
  "hp": 4, "atk": 3, "def": 0,
  "color": "deepPurple",
  "sprite": "wogol_idle",
  "shape": { "body": { "type": "rect", "w": 0.4, "h": 0.65, "color": "deepPurple", "corner": 0.1 }, "head": { "type": "circle", "y": -0.35, "r": 0.18, "color": "deepPurpleLite" }, "eyes": { "type": "eyeDots", "y": -0.35, "spacing": 0.08, "r": 0.03, "color": "silkFlameAmber" } }
},
"ice-zombie": {
  "kind": "enemy",
  "name": "Ice Zombie",
  "hp": 14, "atk": 2, "def": 1,
  "color": "deepPurpleLite",
  "sprite": "ice_zombie_idle",
  "shape": { "body": { "type": "rect", "w": 0.55, "h": 0.75, "color": "deepPurpleLite", "corner": 0.1 }, "head": { "type": "circle", "y": -0.4, "r": 0.22, "color": "boneWhite" }, "eyes": { "type": "eyeDots", "y": -0.4, "spacing": 0.1, "r": 0.04, "color": "deepPurple" } }
}
```

**Add to `sprites.ts` FRAMES** — read attribution file and use real coords. Best-guess (verify):
```ts
chort_idle:      { x: 368, y: 36,  w: 16, h: 16, frames: 4 },
wogol_idle:      { x: 432, y: 36,  w: 16, h: 16, frames: 4 },
ice_zombie_idle: { x: 368, y: 92,  w: 16, h: 16, frames: 4 },
```

**Update `FLOOR_COMPOSITIONS` in `state.ts`:**
```ts
const FLOOR_COMPOSITIONS: Record<number, string[]> = {
  1: ['bone-knight', 'tiny-zombie', 'chort'],
  2: ['bone-knight', 'tiny-zombie', 'imp', 'wogol'],
  3: ['bone-knight', 'imp', 'orc-warrior', 'chort', 'wogol'],
  4: ['masked-orc', 'orc-warrior', 'bone-knight', 'imp', 'ice-zombie'],
}
```

**Verification:**

- [ ] **Step 1: Read attribution file, edit three files.**
- [ ] **Step 2: `bun test && bun run typecheck` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add src/content/archetypes.json src/render/sprites.ts src/core/state.ts
git commit -m "feat(content): 3 new enemy archetypes (chort, wogol, ice-zombie)"
```

---

### T6: Item ground sprites

**Files:**
- Modify: `src/render/sprites.ts`

Add atlas entries for every sprite name referenced in `items.json`. Read `public/sprites/ATLAS_ATTRIBUTION.txt` to verify. Best-guess (verify and adjust):
```ts
flask_red:               { x: 288, y: 224, w: 16, h: 16, frames: 1 },
flask_big_red:           { x: 288, y: 240, w: 16, h: 16, frames: 1 },
flask_yellow:            { x: 304, y: 224, w: 16, h: 16, frames: 1 },
flask_blue:              { x: 320, y: 224, w: 16, h: 16, frames: 1 },
weapon_rusty_sword:      { x: 304, y: 320, w: 16, h: 16, frames: 1 },
weapon_regular_sword:    { x: 320, y: 320, w: 16, h: 16, frames: 1 },
weapon_red_gem_sword:    { x: 336, y: 320, w: 16, h: 16, frames: 1 },
armor_cloth:             { x: 432, y: 320, w: 16, h: 16, frames: 1 },
armor_leather:           { x: 448, y: 320, w: 16, h: 16, frames: 1 },
armor_plate:             { x: 464, y: 320, w: 16, h: 16, frames: 1 },
```

If a sprite name in `items.json` doesn't exist in the atlas, **update both files together** so they stay in sync. `flask_red` is a safe universal fallback.

**Verification:**

- [ ] **Step 1: Verify against atlas + edit.**
- [ ] **Step 2: `bun run typecheck` → clean.**
- [ ] **Step 3: Commit.**
```bash
git add src/render/sprites.ts src/content/items.json
git commit -m "feat(render): atlas frames for potions, weapons, armor"
```

---

### T7: Tile variant rendering

**Files:**
- Modify: `src/render/sprites.ts` (variant frames)
- Modify: `src/render/world.ts` (variant picker)

**`sprites.ts` add** (verify coords):
```ts
floor_1: { x: 16,  y: 64,  w: 16, h: 16, frames: 1 },
floor_2: { x: 32,  y: 64,  w: 16, h: 16, frames: 1 },
floor_3: { x: 48,  y: 64,  w: 16, h: 16, frames: 1 },
wall_top:    { x: 16, y: 0,  w: 16, h: 16, frames: 1 },
wall_side:   { x: 16, y: 16, w: 16, h: 16, frames: 1 },
```

**`world.ts` change** — add variant picker:
```ts
function tileVariantHash(x: number, y: number, n: number): number {
  return ((x * 73 + y * 37) >>> 0) % n
}
```

In the floor render branch:
```ts
const variant = ['floor_1', 'floor_2', 'floor_3'][tileVariantHash(x, y, 3)]
drawTileSprite(ctx, variant, x, y, tileSize)
```

In the wall render branch (decide top vs side by tile above):
```ts
const tileAbove = y > 0 ? state.floor.tiles[(y - 1) * state.floor.width + x] : Tile.Wall
const wallSprite = tileAbove === Tile.Wall ? 'wall_top' : 'wall_side'
drawTileSprite(ctx, wallSprite, x, y, tileSize)
```

(Keep the existing rect/colour fallback for when atlas is not ready.)

**Verification:**

- [ ] **Step 1: Edit + verify atlas coords.**
- [ ] **Step 2: `bun test && bun run typecheck` → green.**
- [ ] **Step 3: Commit.**
```bash
git add src/render/sprites.ts src/render/world.ts
git commit -m "feat(render): tile variants — 3 floor + top/side wall picker"
```

---

### T8: Inventory reducer

**Files:**
- Create: `src/core/reducers/inventory.ts`
- Modify: `src/core/reducers/index.ts`
- Create: `tests/core/reducers/inventory.test.ts`

**`inventory.ts`:**
```ts
import type { World, Action, Item, EquipmentSlot } from '../types'
import { instantiateItem } from '../../content/itemLoader'

const INVENTORY_MAX = 6

type UseAction = Extract<Action, { type: 'UseItem' }>
type EquipAction = Extract<Action, { type: 'EquipItem' }>
type UnequipAction = Extract<Action, { type: 'UnequipItem' }>
type PickupAction = Extract<Action, { type: 'PickupItem' }>

export function useItem(state: World, action: UseAction): World {
  const idx = state.inventory.findIndex(it => it.instanceId === action.instanceId)
  if (idx < 0) return state
  const item = state.inventory[idx]
  if (item.body.kind !== 'potion') return state

  const hero = state.actors[state.heroId]
  if (!hero) return state

  let nextHero = hero
  const eff = item.body.effect
  if (eff.type === 'heal') {
    nextHero = { ...hero, hp: Math.min(hero.maxHp, hero.hp + eff.amount) }
  } else if (eff.type === 'buff-atk') {
    nextHero = { ...hero, statusEffects: [...hero.statusEffects, { kind: 'buff-atk', amount: eff.amount, remainingTicks: eff.durationTicks }] }
  } else if (eff.type === 'buff-def') {
    nextHero = { ...hero, statusEffects: [...hero.statusEffects, { kind: 'buff-def', amount: eff.amount, remainingTicks: eff.durationTicks }] }
  }

  return {
    ...state,
    inventory: state.inventory.filter((_, i) => i !== idx),
    actors: { ...state.actors, [state.heroId]: nextHero },
  }
}

export function equipItem(state: World, action: EquipAction): World {
  const idx = state.inventory.findIndex(it => it.instanceId === action.instanceId)
  if (idx < 0) return state
  const item = state.inventory[idx]
  if (item.body.kind !== 'weapon' && item.body.kind !== 'armor') return state

  const slot: EquipmentSlot = item.body.kind === 'weapon' ? 'weapon' : 'armor'
  const previous = state.equipment[slot]

  const newInv = state.inventory.slice()
  newInv.splice(idx, 1)
  if (previous) newInv.splice(idx, 0, previous)

  return {
    ...state,
    inventory: newInv,
    equipment: { ...state.equipment, [slot]: item },
  }
}

export function unequipItem(state: World, action: UnequipAction): World {
  const equipped = state.equipment[action.slot]
  if (!equipped) return state
  if (state.inventory.length >= INVENTORY_MAX) return state
  return {
    ...state,
    inventory: [...state.inventory, equipped],
    equipment: { ...state.equipment, [action.slot]: null },
  }
}

export function pickupItem(state: World, action: PickupAction): World {
  const ground = state.groundItems.find(g => g.instanceId === action.instanceId)
  if (!ground) return state
  if (state.inventory.length >= INVENTORY_MAX) return state
  const item = instantiateItem(ground.itemId, ground.instanceId)
  return {
    ...state,
    inventory: [...state.inventory, item],
    groundItems: state.groundItems.filter(g => g.instanceId !== ground.instanceId),
  }
}
```

**Wire into `reducers/index.ts`:**
```ts
import { useItem, equipItem, unequipItem, pickupItem } from './inventory'
// In the switch:
case 'UseItem': return useItem(state, action)
case 'EquipItem': return equipItem(state, action)
case 'UnequipItem': return unequipItem(state, action)
case 'PickupItem': return pickupItem(state, action)
case 'MerchantBuyItem': return state // T11 fills
case 'OfferItemReward': return state // T12 fills
case 'PickItemReward': return state  // T12 fills
```

**Tests — `tests/core/reducers/inventory.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import { instantiateItem } from '../../../src/content/itemLoader'
import type { World } from '../../../src/core/types'

function withInventory(seed: string, items: { id: string; instanceId: string }[]): World {
  const base = createInitialWorld(seed)
  return { ...base, inventory: items.map(i => instantiateItem(i.id, i.instanceId)) }
}

describe('inventory reducer', () => {
  it('UseItem heals when potion is heal-small', () => {
    const base = withInventory('inv-1', [{ id: 'heal-small', instanceId: 'p1' }])
    const heroId = base.heroId
    const wounded = { ...base, actors: { ...base.actors, [heroId]: { ...base.actors[heroId], hp: 5 } } }
    const next = dispatch(wounded, { type: 'UseItem', instanceId: 'p1' })
    expect(next.actors[heroId].hp).toBe(10)
    expect(next.inventory.length).toBe(0)
  })

  it('UseItem applies buff-atk for strength-tonic', () => {
    const base = withInventory('inv-2', [{ id: 'strength-tonic', instanceId: 'p2' }])
    const next = dispatch(base, { type: 'UseItem', instanceId: 'p2' })
    const buffs = next.actors[base.heroId].statusEffects.filter(s => s.kind === 'buff-atk')
    expect(buffs.length).toBe(1)
    expect(buffs[0].amount).toBe(2)
  })

  it('EquipItem moves weapon from inventory to equipment.weapon', () => {
    const base = withInventory('inv-3', [{ id: 'iron-blade', instanceId: 'w1' }])
    const next = dispatch(base, { type: 'EquipItem', instanceId: 'w1' })
    expect(next.equipment.weapon?.instanceId).toBe('w1')
    expect(next.inventory.length).toBe(0)
  })

  it('EquipItem swaps with existing equipped item', () => {
    const base = withInventory('inv-4', [{ id: 'iron-blade', instanceId: 'w-new' }])
    const equipped = instantiateItem('rusty-blade', 'w-old')
    const state = { ...base, equipment: { weapon: equipped, armor: null } }
    const next = dispatch(state, { type: 'EquipItem', instanceId: 'w-new' })
    expect(next.equipment.weapon?.instanceId).toBe('w-new')
    expect(next.inventory.find(i => i.instanceId === 'w-old')).toBeDefined()
  })

  it('UnequipItem moves equipment back to inventory', () => {
    const base = createInitialWorld('inv-5')
    const equipped = instantiateItem('iron-blade', 'w1')
    const state = { ...base, equipment: { weapon: equipped, armor: null } }
    const next = dispatch(state, { type: 'UnequipItem', slot: 'weapon' })
    expect(next.equipment.weapon).toBeNull()
    expect(next.inventory.find(i => i.instanceId === 'w1')).toBeDefined()
  })

  it('UnequipItem rejected when inventory is full', () => {
    const base = withInventory('inv-6', [
      { id: 'heal-small', instanceId: 'p1' },
      { id: 'heal-small', instanceId: 'p2' },
      { id: 'heal-small', instanceId: 'p3' },
      { id: 'heal-small', instanceId: 'p4' },
      { id: 'heal-small', instanceId: 'p5' },
      { id: 'heal-small', instanceId: 'p6' },
    ])
    const equipped = instantiateItem('iron-blade', 'w1')
    const state = { ...base, equipment: { weapon: equipped, armor: null } }
    const next = dispatch(state, { type: 'UnequipItem', slot: 'weapon' })
    expect(next.equipment.weapon).not.toBeNull()
  })

  it('PickupItem moves ground item into inventory', () => {
    const base = createInitialWorld('inv-7')
    const state = { ...base, groundItems: [{ instanceId: 'g1', itemId: 'heal-small', pos: { x: 0, y: 0 } }] }
    const next = dispatch(state, { type: 'PickupItem', instanceId: 'g1' })
    expect(next.inventory.length).toBe(1)
    expect(next.groundItems.length).toBe(0)
  })

  it('PickupItem rejected when inventory is full', () => {
    const base = withInventory('inv-8', Array.from({ length: 6 }, (_, i) => ({ id: 'heal-small', instanceId: `p${i}` })))
    const state = { ...base, groundItems: [{ instanceId: 'g1', itemId: 'heal-small', pos: { x: 0, y: 0 } }] }
    const next = dispatch(state, { type: 'PickupItem', instanceId: 'g1' })
    expect(next.inventory.length).toBe(6)
    expect(next.groundItems.length).toBe(1)
  })
})
```

**Verification:**

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `bun test tests/core/reducers/inventory.test.ts` → 8 pass.**
- [ ] **Step 3: `bun test && bun run typecheck` → all green.**
- [ ] **Step 4: Commit.**
```bash
git add src/core/reducers/inventory.ts src/core/reducers/index.ts tests/core/reducers/inventory.test.ts
git commit -m "feat(core): inventory reducer — use, equip, unequip, pickup"
```

---

## Wave 3 — Wiring (serial, 4 tasks)

### T9: Move reducer routes pickups to inventory

**Files:**
- Modify: `src/core/reducers/move.ts`
- Create: `tests/core/reducers/move-pickup.test.ts`

**Plan:**
- Existing `applyItemToHero` (flask logic) is removed.
- `moveActor`'s "hero pickup" block now looks for a `groundItem` at the destination tile. If found and inventory has room, transfer; else leave on ground.

**Replace the flask block:**
```ts
let inventory = state.inventory
let groundItems = state.groundItems
if (actor.id === state.heroId) {
  const groundIdx = groundItems.findIndex(g => g.pos.x === action.to.x && g.pos.y === action.to.y)
  if (groundIdx >= 0 && inventory.length < 6) {
    const ground = groundItems[groundIdx]
    inventory = [...inventory, instantiateItem(ground.itemId, ground.instanceId)]
    groundItems = groundItems.filter((_, i) => i !== groundIdx)
  }
}
```

Carry `inventory` and `groundItems` through into the constructed `stateSoFar`. Drop `applyItemToHero` and the `DroppedItem` import if no other module uses them. Add `import { instantiateItem } from '../../content/itemLoader'` at top.

**Tests** — verify hero pickup adds item to inventory and removes from ground; verify full inventory leaves item on ground.

**Verification:**

- [ ] **Step 1: Edit + add test.**
- [ ] **Step 2: `bun test && bun run typecheck` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add src/core/reducers/move.ts tests/core/reducers/move-pickup.test.ts
git commit -m "feat(core): move pickup writes ground item to inventory"
```

---

### T10: Enemy drop on death

**Files:**
- Modify: `src/core/reducers/attack.ts`
- Create: `tests/core/reducers/enemy-drop.test.ts`

**Plan:** When an attack reduces an enemy's HP to 0 (and the attacker is the hero), roll for a 25% drop using `state.rng`. If the roll succeeds, append a `DroppedItemInstance` to `state.groundItems` at the dead enemy's position. Item id is sampled from `itemPoolForDepth(state.run.depth)`.

```ts
import { itemPoolForDepth } from '../../content/itemLoader'
import { nextU32 } from '../rng'

// inside the attack reducer, after computing newHp:
let nextRng = state.rng
let groundItems = state.groundItems
if (newHp <= 0 && attacker.id === state.heroId) {
  const r1 = nextU32(nextRng); nextRng = r1.state
  if (r1.value % 100 < 25) {
    const pool = itemPoolForDepth(state.run.depth)
    const r2 = nextU32(nextRng); nextRng = r2.state
    const itemId = pool[r2.value % pool.length]
    const r3 = nextU32(nextRng); nextRng = r3.state
    groundItems = [
      ...groundItems,
      { instanceId: `drop-${state.tick}-${r3.value}`, itemId, pos: target.pos },
    ]
  }
}

return { ...state, rng: nextRng, actors: ..., groundItems }
```

**Test:** loop 200 deterministic kills with a fixed seed, count drops, assert ratio is 0.15-0.35.

**Verification:**

- [ ] **Step 1: Implement + statistical test.**
- [ ] **Step 2: `bun test tests/core/reducers/enemy-drop.test.ts` → pass.**
- [ ] **Step 3: `bun test && bun run typecheck` → all green.**
- [ ] **Step 4: Commit.**
```bash
git add src/core/reducers/attack.ts tests/core/reducers/enemy-drop.test.ts
git commit -m "feat(core): 25% item drop on enemy death (depth-weighted)"
```

---

### T11: Merchant trades items, not cards

**Files:**
- Modify: `src/core/reducers/dialog.ts`
- Modify: `tests/core/reducers/merchant.test.ts`

**Replace the existing merchant reducers:**

```ts
import { listItemIds, getItemDef, instantiateItem, itemPoolForDepth } from '../../content/itemLoader'
import { shuffleWithRng } from '../state'

export function openMerchantDialog(state: World, action: OpenMerchantAction): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state

  const pool = itemPoolForDepth(state.run.depth).slice()
  const { result: shuffled, rng } = shuffleWithRng(pool, state.rng)
  const choices = shuffled.slice(0, 3)

  const dialog = {
    title: 'Grim the Wanderer',
    body: 'He sets his wares down and nods.',
    actions: choices.map(itemId => ({
      label: getItemDef(itemId).name,
      resolve: { type: 'MerchantBuyItem' as const, itemId, merchantId: merchant.id },
    })),
  }
  return { ...state, rng, pendingDialog: dialog }
}

export function merchantBuyItem(state: World, action: Extract<Action, { type: 'MerchantBuyItem' }>): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state
  if (state.inventory.length >= 6) {
    return { ...state, pendingDialog: null }
  }
  const r = nextU32(state.rng)
  const item = instantiateItem(action.itemId, `bought-${state.tick}-${r.value}`)
  const actors = { ...state.actors }
  delete actors[action.merchantId]
  return {
    ...state,
    rng: r.state,
    actors,
    turnOrder: state.turnOrder.filter(id => id !== action.merchantId),
    pendingDialog: null,
    inventory: [...state.inventory, item],
  }
}
```

Remove the old `merchantTrade` export. Update `reducers/index.ts` so `MerchantTrade` no longer routes (delete the case) and `MerchantBuyItem` routes to `merchantBuyItem`.

Update `merchant.test.ts` — drop the deck/hand assertion and replace with an inventory assertion. Update the action type from `MerchantTrade` to `MerchantBuyItem`.

**Verification:**

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `bun test tests/core/reducers/merchant.test.ts` → all pass.**
- [ ] **Step 3: `bun test && bun run typecheck` → all green.**
- [ ] **Step 4: Commit.**
```bash
git add src/core/reducers/dialog.ts src/core/reducers/index.ts tests/core/reducers/merchant.test.ts
git commit -m "feat(core): merchant offers items instead of cards"
```

---

### T12: Floor reward becomes item reward

**Files:**
- Modify: `src/loop.ts` (`maybeOfferReward` uses `OfferItemReward`)
- Modify: `src/core/reducers/run.ts` (or the file with `OfferCardReward`) — add OfferItemReward / PickItemReward reducers
- Modify: `src/core/types.ts` — `World.run.pendingReward` becomes `pendingItemReward: string[] | null`
- Create: `tests/core/reducers/item-reward.test.ts`

**Reducer additions:**
```ts
export function offerItemReward(state: World, action: Extract<Action, { type: 'OfferItemReward' }>): World {
  return { ...state, run: { ...state.run, pendingItemReward: action.itemIds } }
}

export function pickItemReward(state: World, action: Extract<Action, { type: 'PickItemReward' }>): World {
  if (!state.run.pendingItemReward?.includes(action.itemId)) return state
  if (state.inventory.length >= 6) {
    return { ...state, run: { ...state.run, pendingItemReward: null, rewardedThisFloor: true } }
  }
  const r = nextU32(state.rng)
  const item = instantiateItem(action.itemId, `reward-${state.tick}-${r.value}`)
  return {
    ...state,
    rng: r.state,
    inventory: [...state.inventory, item],
    run: { ...state.run, pendingItemReward: null, rewardedThisFloor: true },
  }
}
```

`loop.ts`'s `maybeOfferReward` switches from picking 3 card ids to picking 3 item ids from `itemPoolForDepth(state.run.depth + 1)`. Dispatches `OfferItemReward` instead of `OfferCardReward`.

Wire new cases in reducers/index.ts.

**Tests:** offer creates pendingItemReward, pick adds to inventory + clears reward, full-inventory pick clears reward without adding.

**Verification:**

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `bun test tests/core/reducers/item-reward.test.ts` → pass.**
- [ ] **Step 3: `bun test && bun run typecheck` → all green.**
- [ ] **Step 4: Commit.**
```bash
git add src/loop.ts src/core/reducers/run.ts src/core/reducers/index.ts src/core/types.ts tests/core/reducers/item-reward.test.ts
git commit -m "feat(core): end-of-floor reward offers 3 items"
```

---

## Wave 4 — UI rebuild + cleanup (serial, 3 tasks)

### T13: Inventory + item-reward UI components

**Files:**
- Create: `src/ui/inventory.ts`
- Create: `src/ui/itemReward.ts`
- Modify: `src/main.ts` (mount the new components — but DON'T remove cardHand/cardReward yet; T14 does that)

**`src/ui/inventory.ts`** — 6-slot grid styled like cardHand. On click, dispatch `UseItem` for potions or `EquipItem` for weapons/armor. Two extra slots above the inventory show equipped items; click to `UnequipItem`.

```ts
import type { World, Action, Item } from '../core/types'

export type InventoryMount = {
  root: HTMLElement
  update(state: World): void
}

export function mountInventory(parent: HTMLElement, onAction: (a: Action) => void): InventoryMount {
  const root = document.createElement('div')
  root.id = 'inventory-root'
  Object.assign(root.style, {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-end',
    zIndex: '4',
  } satisfies Partial<CSSStyleDeclaration>)

  const equipRow = document.createElement('div')
  Object.assign(equipRow.style, { display: 'flex', gap: '6px' } satisfies Partial<CSSStyleDeclaration>)
  const invRow = document.createElement('div')
  Object.assign(invRow.style, { display: 'flex', gap: '6px' } satisfies Partial<CSSStyleDeclaration>)

  root.appendChild(equipRow)
  root.appendChild(invRow)
  parent.appendChild(root)

  let lastKey = ''

  function makeSlot(label: string): { el: HTMLDivElement; setItem(item: Item | null): void; onClick(cb: () => void): void } {
    const el = document.createElement('div')
    Object.assign(el.style, {
      width: '52px', height: '52px',
      border: '1px solid #5a3e8a',
      borderRadius: '6px',
      background: 'rgba(11, 6, 18, 0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'ui-monospace, monospace', fontSize: '10px',
      color: '#c9b3e8',
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>)
    let onClickCb: (() => void) | null = null
    el.addEventListener('mousedown', e => { e.preventDefault(); onClickCb?.() })
    return {
      el,
      setItem(item) {
        el.title = item ? item.name : `(${label})`
        el.textContent = item ? item.name.slice(0, 4) : ''
      },
      onClick(cb) { onClickCb = cb },
    }
  }

  const weaponSlot = makeSlot('weapon')
  const armorSlot = makeSlot('armor')
  equipRow.appendChild(weaponSlot.el)
  equipRow.appendChild(armorSlot.el)

  const invSlots = Array.from({ length: 6 }, () => makeSlot(''))
  for (const s of invSlots) invRow.appendChild(s.el)

  function update(state: World): void {
    const key = JSON.stringify({
      w: state.equipment.weapon?.instanceId ?? '',
      a: state.equipment.armor?.instanceId ?? '',
      inv: state.inventory.map(i => i.instanceId),
    })
    if (key === lastKey) return
    lastKey = key

    weaponSlot.setItem(state.equipment.weapon)
    weaponSlot.onClick(() => { if (state.equipment.weapon) onAction({ type: 'UnequipItem', slot: 'weapon' }) })
    armorSlot.setItem(state.equipment.armor)
    armorSlot.onClick(() => { if (state.equipment.armor) onAction({ type: 'UnequipItem', slot: 'armor' }) })

    for (let i = 0; i < 6; i++) {
      const item = state.inventory[i] ?? null
      invSlots[i].setItem(item)
      invSlots[i].onClick(() => {
        if (!item) return
        if (item.body.kind === 'potion') onAction({ type: 'UseItem', instanceId: item.instanceId })
        else onAction({ type: 'EquipItem', instanceId: item.instanceId })
      })
    }
  }

  return { root, update }
}
```

**`src/ui/itemReward.ts`** — mirror of cardReward.ts; reads `state.run.pendingItemReward`; shows 3 item buttons; click dispatches `PickItemReward`.

```ts
import type { World, Action } from '../core/types'
import { getItemDef } from '../content/itemLoader'

export type ItemRewardMount = {
  root: HTMLElement
  update(state: World): void
}

export function mountItemReward(parent: HTMLElement, onAction: (a: Action) => void): ItemRewardMount {
  const root = document.createElement('div')
  root.id = 'item-reward-root'
  Object.assign(root.style, {
    position: 'fixed', inset: '0', display: 'none',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)', zIndex: '99',
  } satisfies Partial<CSSStyleDeclaration>)

  const modal = document.createElement('div')
  Object.assign(modal.style, {
    background: '#1a1024', border: '1px solid #5a3e8a',
    padding: '24px 28px', borderRadius: '8px', textAlign: 'center',
  } satisfies Partial<CSSStyleDeclaration>)

  const title = document.createElement('h2')
  title.textContent = 'Choose your spoils'
  Object.assign(title.style, { color: '#f5e6b0', margin: '0 0 16px 0' } satisfies Partial<CSSStyleDeclaration>)

  const row = document.createElement('div')
  Object.assign(row.style, { display: 'flex', gap: '12px' } satisfies Partial<CSSStyleDeclaration>)

  modal.appendChild(title)
  modal.appendChild(row)
  root.appendChild(modal)
  parent.appendChild(root)

  let lastKey = ''
  function update(state: World): void {
    const offered = state.run.pendingItemReward
    if (!offered) {
      root.style.display = 'none'
      lastKey = ''
      return
    }
    root.style.display = 'flex'
    const key = offered.join('|')
    if (key === lastKey) return
    lastKey = key
    row.replaceChildren()
    for (const id of offered) {
      const def = getItemDef(id)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = def.name
      Object.assign(btn.style, {
        background: '#3e2a5c', color: '#f5e6b0',
        border: '1px solid #8b6f47', borderRadius: '4px',
        padding: '12px 16px', fontSize: '14px', cursor: 'pointer',
      } satisfies Partial<CSSStyleDeclaration>)
      btn.addEventListener('click', () => onAction({ type: 'PickItemReward', itemId: id }))
      row.appendChild(btn)
    }
  }
  return { root, update }
}
```

**`main.ts`** — add the two mounts + their `.update(state)` calls. Don't remove cardHand/cardReward yet.

**Verification:**

- [ ] **Step 1: Create the two UI files + wire in main.**
- [ ] **Step 2: `bun run typecheck && bun test && bun run build` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add src/ui/inventory.ts src/ui/itemReward.ts src/main.ts
git commit -m "feat(ui): inventory grid + item reward modal"
```

---

### T14: Remove card system entirely

**Files (delete):**
- `src/content/cards.json`
- `src/content/cardLoader.ts`
- `src/core/reducers/card.ts`
- `src/ui/cardHand.ts`
- `src/ui/cardReward.ts`
- `tests/core/reducers/card.test.ts`
- `tests/content/cardLoader.test.ts`

**Files (modify):**
- `src/core/types.ts` — remove `RunCards`, `World.run.cards`, action types `PlayCard` / `OfferCardReward` / `PickCardReward` / `MerchantTrade`
- `src/core/state.ts` — drop `cards` from initial run state
- `src/core/reducers/index.ts` — drop card cases
- `src/core/reducers/dialog.ts` — drop `merchantTrade` (replaced by `merchantBuyItem` in T11)
- `src/core/dispatch.ts` — drop card-action exhaustive cases
- `src/main.ts` — drop `mountCardHand` / `mountCardReward` mounts and the `targetingCardId` plumbing; drop the click-targeting branch in `onTileClick`
- Any test fixture that referenced `run.cards` — update or delete

**Verification:**

- [ ] **Step 1: Delete files, fix all callers + types until typecheck is clean.**
- [ ] **Step 2: `bun test && bun run typecheck && bun run build` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add -A
git commit -m "refactor: remove card system (replaced by inventory/items)"
```

---

### T15: HUD effective stats

**Files:**
- Modify: `src/ui/hud.ts`

In the per-frame `update` block where ATK/DEF are read from `hero.atk` / `hero.def`, replace with calls to the new selectors:
```ts
import { effectiveAtk, effectiveDef } from '../core/selectors'
// ...
atkStat.setValue(String(effectiveAtk(state, state.heroId)))
defStat.setValue(String(effectiveDef(state, state.heroId)))
```

**Verification:**

- [ ] **Step 1: Edit.**
- [ ] **Step 2: `bun run typecheck && bun test && bun run build` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add src/ui/hud.ts
git commit -m "feat(ui): HUD shows effective ATK/DEF (equipment + buffs)"
```

---

## Wave 5 — Music + finalization (serial, 2 tasks)

### T16: Procedural ambient music

**Files:**
- Create: `src/audio/music.ts`
- Modify: `src/main.ts` (instantiate, wire volume, change mood on Descend)

**`src/audio/music.ts`:**
```ts
export type MusicHandle = {
  start(): void
  stop(): void
  setVolume(v: number): void
  setMoodForDepth(depth: number): void
}

type Mood = { scale: readonly number[]; bpm: number; root: number }
const MOODS: Record<number, Mood> = {
  1: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220 },
  2: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220 },
  3: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 70, root: 220 },
  4: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 80, root: 196 },
  5: { scale: [0, 2, 3, 5, 7, 8, 11], bpm: 100, root: 220 },
}

function freqAt(root: number, semis: number, octave = 0): number {
  return root * Math.pow(2, semis / 12 + octave)
}

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function createMusic(seed: string): MusicHandle {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  let mood: Mood = MOODS[1]
  let stepIdx = 0
  let nextStepAt = 0
  let running = false
  let rngState = hash(seed)

  function rand(): number {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0
    return rngState / 0xffffffff
  }

  function playNote(freq: number, durMs: number, gain: number): void {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    env.gain.setValueAtTime(0, ctx.currentTime)
    env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.03)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
    osc.connect(env).connect(master)
    osc.start()
    osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
  }

  function tick(now: number): void {
    if (!running) return
    if (now >= nextStepAt) {
      const stepMs = 60000 / mood.bpm / 2
      if (rand() < 0.5) {
        const semi = mood.scale[Math.floor(rand() * mood.scale.length)]
        const octave = rand() < 0.3 ? 1 : 0
        playNote(freqAt(mood.root, semi, octave), stepMs * 1.5, 0.08)
      }
      if (stepIdx % 8 === 0) {
        playNote(freqAt(mood.root, mood.scale[0], -1), stepMs * 8, 0.04)
      }
      stepIdx++
      nextStepAt = now + stepMs
    }
    requestAnimationFrame(tick)
  }

  return {
    start() {
      if (running) return
      running = true
      ctx.resume().catch(() => {})
      nextStepAt = performance.now()
      requestAnimationFrame(tick)
    },
    stop() { running = false },
    setVolume(v) {
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05)
    },
    setMoodForDepth(d) {
      mood = MOODS[d] ?? MOODS[5]
    },
  }
}
```

**Wire in `main.ts`:**
- Create `const music = createMusic(world.seed)` after sfx.
- Start music on first user interaction (use the existing gesture-unlock if present, or wire to the first onTileClick).
- After dispatching `Descend`, call `music.setMoodForDepth(state.run.depth)`.
- Wire the existing dev-menu volume slider to also call `music.setVolume(v * 0.5)` (slightly quieter than sfx).

**Verification:**

- [ ] **Step 1: Implement music + wire.**
- [ ] **Step 2: `bun run typecheck && bun test && bun run build` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add src/audio/music.ts src/main.ts
git commit -m "feat(audio): procedural ambient music — per-floor mood, web audio synthesised"
```

---

### T17: README + smoke checklist

**Files:**
- Modify: `README.md`

Add a Phase 1E section with the new mechanics + smoke checklist:

```markdown
## Phase 1E — Inventory & Equipment

Spec: `docs/plans/2026-04-18-phase-1e-design.md`.
Plan: `docs/plans/2026-04-18-phase-1e-plan.md`.

- **Inventory.** 6 slots, bottom of screen. Click a potion to drink, click
  a weapon/armor to equip. Click an equipped item to unequip.
- **Equipment.** Two slots: weapon (+atk) and armor (+def). HUD shows
  effective ATK/DEF including equipment and active buffs.
- **Items.** 4 potions + 3 weapon tiers + 3 armor tiers. Enemies drop one
  ~25% of the time (depth-tiered). Merchant offers 3 items. End-of-floor
  reward picks 3.
- **No more cards.** The card system has been replaced. Old saves are
  auto-wiped on first load (schema upgrade).
- **Sprite variety.** Walls and floors now show multiple atlas variants.
  Three new enemy archetypes (chort, wogol, ice-zombie) appear on later
  floors.
- **Procedural music.** Ambient pad + melody, per-floor mood. Synthesised
  in-browser via Web Audio — no audio assets to load.

### Phase 1E smoke checklist

1. First load shows "previous run wiped" log line in console (if a Phase 1D save existed).
2. Fresh run — inventory empty, no equipment, HP 20/20.
3. Kill an enemy a few times — eventually one drops a flask sprite on the ground; walk onto it → goes into inventory.
4. Click the flask in inventory → HP restored, slot clears.
5. Pick up a weapon → click in inventory → equipped, HUD ATK goes up by the weapon's bonus.
6. Click the equipped weapon → unequipped, slot returns to inventory, HUD ATK drops.
7. Descend to floor 2 → merchant appears; click → modal shows 3 items; pick one → goes into inventory.
8. Floors show multiple wall + floor sprite variants (visual diversity).
9. Audio plays on first interaction; pitch/tempo changes on descend; volume slider in dev menu controls it.
10. Tests: `bun test` → all green. Typecheck + build clean.
```

**Verification:**

- [ ] **Step 1: Edit README.**
- [ ] **Step 2: `bun test && bun run typecheck && bun run build` → all green.**
- [ ] **Step 3: Commit.**
```bash
git add README.md
git commit -m "docs: phase 1e readme + smoke checklist"
```

---

## Dispatch notes

- **Wave 1 (T1 → T2 → T3 → T4)** strictly serial — types, schema, content, selectors all stack.
- **Wave 2 (T5, T6, T7, T8)** mostly disjoint. T5/T6/T7 all touch `sprites.ts` so use sub-worktrees + cherry-pick to avoid conflicts. T8 is fully disjoint and can run in parallel with any of them.
- **Wave 3 (T9 → T10 → T11 → T12)** serial — each touches `move.ts` / `attack.ts` / `dialog.ts` / `loop.ts` and the action types interact.
- **Wave 4 (T13 → T14 → T15)** serial — T14 deletes the card system which T13 had been running alongside.
- **Wave 5 (T16 → T17)** serial.

**Estimate:** 17 tasks, ~4 hours wall-clock with subagents.

## Success criterion

All items in the spec's "Success criteria" section pass. Merge to master via `git reset --hard feat/phase-1e` (authorised pattern).
