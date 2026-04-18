# Phase 1D Implementation Plan

> **Executor:** subagent-driven-development, same pattern as 1B/1C. Waves run in parallel internally; serialize between waves. Each task ends in one commit.

**Goal:** Implement Phase 1D per `docs/plans/2026-04-18-phase-1d-design.md` — merchant NPC, lore scrolls, shrines, 3 new cards, generic dialog modal.

**Architecture:** Dialog modal is the shared UI spine. A new `World.pendingDialog` transient field is set by side-effect reducers (scroll/shrine move-onto, merchant adjacency) and cleared by a `ClearDialog` action. NPCs join the `Actor.kind` union; shrines join the `Tile` union. Three new cards reuse existing effect kinds (`heal`, `buff-def`, `buff-atk`). `card.ts` may need a `buff-def` branch.

**Tech Stack:** Bun + Vite + TypeScript strict, existing reducer/selector pattern, existing 0x72 atlas.

**Working directory:** `.worktrees/phase-1d`
**Branch:** `feat/phase-1d`

**Conventions:**
- TDD where possible (pure reducers). For DOM glue (`dialog.ts`, render tweaks), skip unit tests — runtime smoke after Wave 4.
- Each task ends with `bun run typecheck` + relevant `bun test` + commit.
- No `bun x` prefix.
- All paths relative to the worktree.

---

## Wave 1 — Core type plumbing + dialog skeleton (serial, 3 tasks)

### T1: Types + World additions

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/state.ts` (init new fields)
- Modify: `tests/ai/pathfind.test.ts` (fixture needs new fields)

**Changes to `types.ts`:**
- Add `Shrine = 4` to the `Tile` const.
- `Actor.kind` → `'hero' | 'enemy' | 'npc'`.
- Add new `HeroIntent` variant: `| { kind: 'interact'; targetId: ActorId }`.
- Add `LoreScroll` type:
  ```ts
  export type LoreScroll = { id: string; pos: Pos; fragmentIndex: number }
  ```
- Add `PendingDialog` type and field on World:
  ```ts
  export type DialogAction =
    | { type: 'ResolveShrine'; choice: 'blood' | 'breath'; pos: Pos }
    | { type: 'MerchantTrade'; cardId: string; merchantId: ActorId }
    | { type: 'ClearDialog' }

  export type PendingDialog = {
    title: string
    body: string
    actions: Array<{ label: string; resolve: DialogAction | null }>
  }
  ```
- Add fields on `World`: `loreScrolls: LoreScroll[]`, `pendingDialog: PendingDialog | null`.
- Add new `Action` variants (the full `Action` union gains these — they're the in-world actions, not just `DialogAction`):
  ```ts
  | { type: 'OpenMerchantDialog'; merchantId: ActorId }
  | { type: 'MerchantTrade'; cardId: string; merchantId: ActorId }
  | { type: 'ResolveShrine'; choice: 'blood' | 'breath'; pos: Pos }
  | { type: 'ClearDialog' }
  ```

**Changes to `state.ts`:**
- In `createInitialWorld`, return value gains `loreScrolls: []`, `pendingDialog: null`.

**Changes to `tests/ai/pathfind.test.ts`:** fixture's manual `World` literal needs `loreScrolls: []` and `pendingDialog: null` added.

**Verification steps:**

- [ ] **Step 1: Apply edits above.**

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`
Expected: clean. If fixtures elsewhere break on missing fields, add them (grep `run: {` inside `tests/` for likely fixture sites).

- [ ] **Step 3: Full test suite passes (no behavior change yet).**
Run: `bun test`
Expected: 173 pass, 0 fail.

- [ ] **Step 4: Commit.**
```bash
git add src/core/types.ts src/core/state.ts tests/ai/pathfind.test.ts
git commit -m "feat(core): phase 1d types — npc kind, shrine tile, dialog state"
```

---

### T2: Dialog reducer — ClearDialog + stubs

**Files:**
- Create: `src/core/reducers/dialog.ts`
- Modify: `src/core/reducers/index.ts`
- Create: `tests/core/reducers/dialog.test.ts`

**Behavior:**
- `ClearDialog` → sets `state.pendingDialog = null`, returns state unchanged otherwise. No-op when already null.
- `OpenMerchantDialog`, `ResolveShrine`, `MerchantTrade` → typed handlers that for Wave 1 are stubs returning `state` unchanged. Filled in by Wave 3 tasks T8/T10.

**`src/core/reducers/dialog.ts` (full):**
```ts
import type { World, Action } from '../types'

type OpenMerchantAction = Extract<Action, { type: 'OpenMerchantDialog' }>
type MerchantTradeAction = Extract<Action, { type: 'MerchantTrade' }>
type ResolveShrineAction = Extract<Action, { type: 'ResolveShrine' }>

export function clearDialog(state: World): World {
  if (state.pendingDialog === null) return state
  return { ...state, pendingDialog: null }
}

// Stubs filled in by Wave 3 tasks (T8 for merchant, T10 for shrine).
export function openMerchantDialog(state: World, _action: OpenMerchantAction): World {
  return state
}

export function merchantTrade(state: World, _action: MerchantTradeAction): World {
  return state
}

export function resolveShrine(state: World, _action: ResolveShrineAction): World {
  return state
}
```

**`src/core/reducers/index.ts` (add cases):**
```ts
import { clearDialog, openMerchantDialog, merchantTrade, resolveShrine } from './dialog'

// ... inside rootReducer switch:
case 'ClearDialog': return clearDialog(state)
case 'OpenMerchantDialog': return openMerchantDialog(state, action)
case 'MerchantTrade': return merchantTrade(state, action)
case 'ResolveShrine': return resolveShrine(state, action)
```

**Tests — `tests/core/reducers/dialog.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'

describe('ClearDialog', () => {
  it('nulls pendingDialog when set', () => {
    const base = createInitialWorld('dlg-1')
    const state = {
      ...base,
      pendingDialog: { title: 't', body: 'b', actions: [] },
    }
    const next = dispatch(state, { type: 'ClearDialog' })
    expect(next.pendingDialog).toBeNull()
  })

  it('is a no-op when pendingDialog is already null', () => {
    const base = createInitialWorld('dlg-2')
    expect(base.pendingDialog).toBeNull()
    const next = dispatch(base, { type: 'ClearDialog' })
    expect(next).toBe(base)
  })
})
```

**Verification:**

- [ ] **Step 1: Write test, reducer, and wire.**

- [ ] **Step 2: Run the new test.**
Run: `bun test tests/core/reducers/dialog.test.ts`
Expected: 2 pass.

- [ ] **Step 3: Full suite.**
Run: `bun test && bun run typecheck`
Expected: all green, 175 pass.

- [ ] **Step 4: Commit.**
```bash
git add src/core/reducers/dialog.ts src/core/reducers/index.ts tests/core/reducers/dialog.test.ts
git commit -m "feat(core): dialog reducer — ClearDialog + stubs for shrine/merchant"
```

---

### T3: Generic dialog modal UI

**Files:**
- Create: `src/ui/dialog.ts`
- Modify: `src/main.ts` (mount + per-frame update)

**`src/ui/dialog.ts` (full):**
```ts
import type { Action, World } from '../core/types'

export type DialogMount = {
  root: HTMLElement
  update(state: World): void
  destroy(): void
}

export function mountDialog(
  parent: HTMLElement,
  onAction: (a: Action) => void,
): DialogMount {
  const root = document.createElement('div')
  root.id = 'dialog-root'
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: '100',
  } satisfies Partial<CSSStyleDeclaration>)

  const modal = document.createElement('div')
  Object.assign(modal.style, {
    background: '#1a1024',
    border: '1px solid #5a3e8a',
    padding: '28px 32px',
    borderRadius: '8px',
    textAlign: 'center',
    maxWidth: '460px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
  } satisfies Partial<CSSStyleDeclaration>)

  const titleEl = document.createElement('h2')
  Object.assign(titleEl.style, {
    margin: '0 0 12px 0',
    fontFamily: "'UnifrakturMaguntia', ui-serif, Georgia, serif",
    fontSize: '30px',
    color: '#f5e6b0',
    letterSpacing: '0.03em',
  } satisfies Partial<CSSStyleDeclaration>)

  const bodyEl = document.createElement('p')
  Object.assign(bodyEl.style, {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#c9b3e8',
    lineHeight: '1.5',
  } satisfies Partial<CSSStyleDeclaration>)

  const buttonRow = document.createElement('div')
  Object.assign(buttonRow.style, {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  } satisfies Partial<CSSStyleDeclaration>)

  modal.appendChild(titleEl)
  modal.appendChild(bodyEl)
  modal.appendChild(buttonRow)
  root.appendChild(modal)
  parent.appendChild(root)

  let lastKey = ''

  function update(state: World): void {
    const pd = state.pendingDialog
    if (!pd) {
      root.style.display = 'none'
      lastKey = ''
      return
    }
    root.style.display = 'flex'
    const key = `${pd.title}|${pd.body}|${pd.actions.map(a => a.label).join(',')}`
    if (key === lastKey) return
    lastKey = key

    titleEl.textContent = pd.title
    bodyEl.textContent = pd.body
    buttonRow.replaceChildren()
    for (const act of pd.actions) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = act.label
      Object.assign(btn.style, {
        background: '#3e2a5c',
        color: '#f5e6b0',
        border: '1px solid #8b6f47',
        borderRadius: '4px',
        padding: '10px 16px',
        fontSize: '14px',
        cursor: 'pointer',
      } satisfies Partial<CSSStyleDeclaration>)
      btn.addEventListener('click', () => {
        if (act.resolve) onAction(act.resolve)
        onAction({ type: 'ClearDialog' })
      })
      buttonRow.appendChild(btn)
    }
  }

  return {
    root,
    update,
    destroy() { root.remove() },
  }
}
```

**`src/main.ts` changes:**
```ts
// add to imports:
import { mountDialog } from './ui/dialog'

// After mountOverlay / mountCardHand etc., add (before or after cardReward is fine):
const dialog = mountDialog(hudContainer, (a) => loop.submit(a))

// Inside the onFrame callback, alongside other `.update(state)` calls:
dialog.update(state)
```

**Verification:**

- [ ] **Step 1: Implement.**

- [ ] **Step 2: Typecheck clean.**
Run: `bun run typecheck`

- [ ] **Step 3: Full suite still green.**
Run: `bun test`
Expected: 175 pass.

- [ ] **Step 4: Commit.**
```bash
git add src/ui/dialog.ts src/main.ts
git commit -m "feat(ui): generic dialog modal reads world.pendingDialog"
```

---

## Wave 2 — Content + reducer branches (parallel, 3 tasks)

All three touch disjoint files, dispatch in parallel.

### T4: 3 new cards + buff-def card effect branch

**Files:**
- Modify: `src/content/cards.json`
- Modify: `src/core/reducers/card.ts` (add `buff-def` branch if missing)
- Modify: `tests/core/reducers/card.test.ts` (add 3 coverage tests)

**Add to `cards.json`:**
```json
{ "id": "greater-heal", "name": "Greater Heal", "description": "Restore 12 HP",
  "target": "self", "effect": { "kind": "heal", "amount": 12 } },
{ "id": "fortify", "name": "Fortify", "description": "+2 DEF for 6 ticks",
  "target": "self", "effect": { "kind": "buff-def", "amount": 2, "durationTicks": 6 } },
{ "id": "vigor", "name": "Vigor", "description": "+3 ATK for 3 ticks",
  "target": "self", "effect": { "kind": "buff-atk", "amount": 3, "durationTicks": 3 } }
```

**Check `card.ts`:** open and confirm there is no `effect.kind === 'buff-def'` branch. If absent, add it below the `buff-atk` branch (mirror of that code):
```ts
} else if (effect.kind === 'buff-def') {
  const target = actors[targetActorId!]
  const newEffect: StatusEffect = { kind: 'buff-def', amount: effect.amount, remainingTicks: effect.durationTicks }
  actors = { ...actors, [targetActorId!]: { ...target, statusEffects: [...target.statusEffects, newEffect] } }
```

Also update the `CardEffect` union in `src/content/cardLoader.ts` to include `buff-def` if missing:
```ts
| { kind: 'buff-def'; amount: number; durationTicks: number }
```

**New tests — append to `tests/core/reducers/card.test.ts`:**
```ts
  it('greater-heal restores 12 HP capped at maxHp', () => {
    const base = createInitialWorld('gh-1')
    const heroId = base.heroId
    const hero = base.actors[heroId]
    const wounded: World = {
      ...base,
      actors: { ...base.actors, [heroId]: { ...hero, hp: 5 } },
      run: { ...base.run, cards: { ...base.run.cards, hand: ['greater-heal'] } },
    }
    const next = dispatch(wounded, { type: 'PlayCard', cardId: 'greater-heal' })
    expect(next.actors[heroId].hp).toBe(17)
  })

  it('fortify applies buff-def status', () => {
    const base = createInitialWorld('frt-1')
    const heroId = base.heroId
    const state: World = {
      ...base,
      run: { ...base.run, cards: { ...base.run.cards, hand: ['fortify'] } },
    }
    const next = dispatch(state, { type: 'PlayCard', cardId: 'fortify' })
    const buffs = next.actors[heroId].statusEffects.filter(s => s.kind === 'buff-def')
    expect(buffs.length).toBe(1)
    expect(buffs[0].amount).toBe(2)
  })

  it('vigor applies buff-atk status', () => {
    const base = createInitialWorld('vgr-1')
    const heroId = base.heroId
    const state: World = {
      ...base,
      run: { ...base.run, cards: { ...base.run.cards, hand: ['vigor'] } },
    }
    const next = dispatch(state, { type: 'PlayCard', cardId: 'vigor' })
    const buffs = next.actors[heroId].statusEffects.filter(s => s.kind === 'buff-atk')
    expect(buffs.some(b => b.amount === 3)).toBe(true)
  })
```

(Import `World` from types at top of file if not already imported.)

**Verification:**

- [ ] **Step 1: Implement.**

- [ ] **Step 2: Run card tests.**
Run: `bun test tests/core/reducers/card.test.ts`
Expected: existing pass + 3 new pass.

- [ ] **Step 3: Full suite.**
Run: `bun test && bun run typecheck`

- [ ] **Step 4: Commit.**
```bash
git add src/content/cards.json src/core/reducers/card.ts src/content/cardLoader.ts tests/core/reducers/card.test.ts
git commit -m "feat(content): 3 cards (greater-heal, fortify, vigor) + buff-def branch"
```

---

### T5: Lore content file

**Files:**
- Create: `src/content/lore.json`
- Create: `src/content/loreLoader.ts`
- Create: `tests/content/loreLoader.test.ts`

**`src/content/lore.json`:**
```json
[
  { "id": 0, "title": "Before the Skulls",
    "body": "They were kings once, in a hall where candles never guttered. Someone counted the years and found them too many." },
  { "id": 1, "title": "The First Oath",
    "body": "The kings swore their bones to the work, and then their names. The throne kept both." },
  { "id": 2, "title": "What the Marrow Remembers",
    "body": "You walk corridors their shadows cut. The walls are warm where a crown once rested." },
  { "id": 3, "title": "The Last Breath",
    "body": "Grim said only one thing before the door closed: 'Break the bone tide, or feed it.' He did not say which was kinder." }
]
```

**`src/content/loreLoader.ts`:**
```ts
import raw from './lore.json'

export type LoreFragment = {
  id: number
  title: string
  body: string
}

const fragments: readonly LoreFragment[] = raw as readonly LoreFragment[]

export function getLoreFragment(index: number): LoreFragment {
  const f = fragments[index]
  if (!f) throw new Error(`unknown lore fragment index: ${index}`)
  return f
}

export function loreCount(): number {
  return fragments.length
}
```

**Tests — `tests/content/loreLoader.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { getLoreFragment, loreCount } from '../../src/content/loreLoader'

describe('loreLoader', () => {
  it('has exactly 4 fragments', () => {
    expect(loreCount()).toBe(4)
  })

  it('returns well-formed fragments for indices 0..3', () => {
    for (let i = 0; i < 4; i++) {
      const f = getLoreFragment(i)
      expect(f.id).toBe(i)
      expect(f.title.length).toBeGreaterThan(0)
      expect(f.body.length).toBeGreaterThan(0)
    }
  })

  it('throws on unknown index', () => {
    expect(() => getLoreFragment(9)).toThrow()
  })
})
```

**Verification:**

- [ ] **Step 1: Write files + test.**

- [ ] **Step 2: Run test.**
Run: `bun test tests/content/loreLoader.test.ts`
Expected: 3 pass.

- [ ] **Step 3: Commit.**
```bash
git add src/content/lore.json src/content/loreLoader.ts tests/content/loreLoader.test.ts
git commit -m "feat(content): 4-fragment lore arc + loader"
```

---

### T6: Sprite registry additions (merchant + scroll + shrine glyph)

**Files:**
- Modify: `src/render/sprites.ts`

Add to the `FRAMES` record (the user's existing format is `{x, y, w, h, frames}`):

```ts
// Merchant — 16×28, reusing wizzard_m_idle from the atlas
wizzard_m_idle: { x: 128, y: 132, w: 16, h: 28, frames: 4 },

// Scroll — one-shot static tile for pickups
scroll:         { x: 288, y: 320, w: 16, h: 16, frames: 1 },
```

*Note:* Verify `wizzard_m_idle` and `scroll` positions against `public/sprites/ATLAS_ATTRIBUTION.txt`. The positions above are from `tiles_list_v1.3.txt`: `wizzard_m_idle_anim 128 132 16 28 4` and (for the scroll — atlas has limited scroll sprite options; use a flask or a chest base). If `scroll` isn't a named entry, reuse one of these visually-scroll-like tiles:
- `flask_green` at `(320, 240, 16, 16)` as a fallback (substitute this sprite name in `FRAMES` and in T9 rendering).

Accept whichever candidate matches; grep the attribution file first.

**Verification:**

- [ ] **Step 1: Edit `sprites.ts` with the two new entries.**

- [ ] **Step 2: Typecheck.**
Run: `bun run typecheck`

- [ ] **Step 3: Full suite (render changes can't easily be unit-tested, runtime smoke comes in Wave 4).**
Run: `bun test`
Expected: all green.

- [ ] **Step 4: Commit.**
```bash
git add src/render/sprites.ts
git commit -m "feat(render): sprite entries — wizzard_m_idle for merchant, scroll for lore"
```

---

## Wave 3 — Features (parallel after Wave 2, 4 tasks)

Each task touches disjoint files (with one careful overlap noted).

### T7: NPC kind — no attack, no AI

**Files:**
- Modify: `src/core/reducers/attack.ts`
- Modify: `src/ai/behaviors/chase.ts`
- Modify: `src/ai/planner.ts` (only if NPC routing is needed there)
- Create: `tests/core/reducers/npc.test.ts`

**`attack.ts` change** — inside `attackActor`, reject NPC targets. Add right after the existing `alive` guards:
```ts
if (target.kind === 'npc') return state
```

**`chase.ts` change** — inside `chaseHero(state, actorId)`, if `actor.kind === 'npc'`, return `{ type: 'TurnAdvance' }`. But chase is typically only called for enemies; double-check. If `planner.decide` can produce NPC decisions, add an early return there instead:
```ts
// planner.ts, at top of decide:
if (state.actors[actorId].kind === 'npc') return { type: 'TurnAdvance' }
```

Read `src/ai/planner.ts` and apply the early-return at the call site that makes most sense given its current structure.

**Test — `tests/core/reducers/npc.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { Actor, World } from '../../../src/core/types'

describe('npc actors', () => {
  it('hero attack against an NPC is rejected', () => {
    const base = createInitialWorld('npc-1')
    const heroPos = base.actors[base.heroId].pos
    const npc: Actor = {
      id: 'merchant-test',
      kind: 'npc',
      archetype: 'merchant',
      pos: { x: heroPos.x + 1, y: heroPos.y },
      hp: 1, maxHp: 1, atk: 0, def: 0,
      alive: true,
      statusEffects: [],
    }
    const state: World = { ...base, actors: { ...base.actors, [npc.id]: npc } }
    const next = dispatch(state, { type: 'AttackActor', attackerId: base.heroId, targetId: npc.id })
    expect(next.actors[npc.id].hp).toBe(1)
    expect(next.actors[npc.id].alive).toBe(true)
  })
})
```

(This test relies on `merchant` archetype — added in T8. If running this task solo before T8, comment out the test or stub the archetype. In the intended parallel-after-Wave-2 flow, T8 lands before the suite converges.)

**Verification:**

- [ ] **Step 1: Implement.**

- [ ] **Step 2: Run npc test (will fail if merchant archetype not yet loaded — skip if so).**
Run: `bun test tests/core/reducers/npc.test.ts`

- [ ] **Step 3: Full suite.**
Run: `bun test && bun run typecheck`

- [ ] **Step 4: Commit.**
```bash
git add src/core/reducers/attack.ts src/ai/behaviors/chase.ts src/ai/planner.ts tests/core/reducers/npc.test.ts
git commit -m "feat(core): npc kind — attack rejected, AI no-op"
```

---

### T8: Merchant archetype + spawn + interaction flow

**Files:**
- Modify: `src/content/archetypes.json`
- Modify: `src/core/state.ts` (add `spawnMerchant` helper)
- Modify: `src/core/reducers/descend.ts` (call `spawnMerchant` on depth ∈ {2, 4})
- Modify: `src/core/reducers/dialog.ts` (fill `openMerchantDialog` + `merchantTrade`)
- Modify: `src/input/intent.ts` (NPC click → interact intent)
- Modify: `src/ai/heroAuto.ts` (interact intent → path-adjacent → OpenMerchantDialog)
- Create: `tests/core/reducers/merchant.test.ts`

**Add to `archetypes.json`:**
```json
"merchant": {
  "kind": "npc",
  "name": "Grim the Wanderer",
  "hp": 1,
  "atk": 0,
  "def": 0,
  "color": "silkFlameAmber",
  "sprite": "wizzard_m_idle",
  "shape": {
    "body":   { "type": "rect", "w": 0.5, "h": 0.75, "color": "silkFlameAmber", "corner": 0.15 },
    "head":   { "type": "circle", "y": -0.4, "r": 0.22, "color": "boneWhite" },
    "eyes":   { "type": "eyeDots", "y": -0.4, "spacing": 0.1, "r": 0.03, "color": "deepPurpleDark" }
  }
}
```

(The `shape` is a fallback used before the atlas loads.)

**`spawnMerchant` in `state.ts`** — place near `spawnEnemiesOnFloor`:
```ts
export function spawnMerchant(spawns: Floor['spawns'], depth: number): Actor | null {
  // Place adjacent to the hero spawn in a fixed offset. If off-map or on wall,
  // skip this floor (merchant simply absent).
  const hero = spawns[0]
  if (!hero) return null
  const id: ActorId = `merchant-d${depth}`
  const def = getArchetype('merchant')
  return {
    id,
    kind: 'npc',
    archetype: 'merchant',
    pos: { x: hero.x + 2, y: hero.y }, // caller is responsible for checking walkability
    hp: def.hp, maxHp: def.hp,
    atk: def.atk, def: def.def,
    alive: true,
    statusEffects: [],
  }
}
```

*Note:* `spawnMerchant` returns a candidate without walkability validation. `descend.ts` validates:

**`descend.ts` additions:**
```ts
// After building the fresh actors/enemies, add merchant if applicable:
if (newDepth === 2 || newDepth === 4) {
  const m = spawnMerchant(newSpawns, newDepth)
  if (m && isFloorOrStairsTile(newFloor, m.pos)) {
    actors[m.id] = m
    turnOrder.push(m.id)
  }
}
```

Where `isFloorOrStairsTile` is a tiny helper in `descend.ts`:
```ts
function isFloorOrStairsTile(floor: Floor, p: Pos): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= floor.width || p.y >= floor.height) return false
  const t = floor.tiles[p.y * floor.width + p.x]
  return t === Tile.Floor || t === Tile.Stairs || t === Tile.Shrine
}
```

**`intent.ts` change** — in `intentForClick`, when the clicked tile contains an actor of `kind: 'npc'`:
```ts
if (a.alive && a.pos.x === tile.x && a.pos.y === tile.y) {
  if (a.kind === 'npc') {
    return { type: 'SetHeroIntent', intent: { kind: 'interact', targetId: id } }
  }
  return { type: 'SetHeroIntent', intent: { kind: 'attack', targetId: id } }
}
```

**`heroAuto.ts` change** — handle the new `interact` intent. Inside `resolveHeroActions`:
```ts
if (state.heroIntent.kind === 'interact') {
  const target = state.actors[state.heroIntent.targetId]
  if (!target || !target.alive) return [{ type: 'SetHeroIntent', intent: null }]
  if (isAdjacent(hero.pos, target.pos)) {
    return [
      { type: 'OpenMerchantDialog', merchantId: target.id },
      { type: 'SetHeroIntent', intent: null },
    ]
  }
  // otherwise path adjacent
  const step = firstStepToward(state, hero.pos, target.pos, { passThroughActors: [target.id] })
  if (!step) return [{ type: 'SetHeroIntent', intent: null }]
  return [{ type: 'MoveActor', actorId: state.heroId, from: hero.pos, to: step }]
}
```

Read the current `heroAuto.ts` to confirm the exact imports/shape; `isAdjacent` helper may already exist in that file or in `pathfind.ts`.

**`openMerchantDialog` reducer** — builds the dialog with 3 card choices drawn from the pool using world RNG (deterministic):
```ts
import { listCardIds } from '../../content/cardLoader'
import { getCard } from '../../content/cardLoader'
import { nextU32 } from '../rng'

export function openMerchantDialog(state: World, action: Extract<Action, { type: 'OpenMerchantDialog' }>): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state

  // Shuffle a copy of the pool using world.rng; take first 3.
  const pool = listCardIds().slice()
  let rng = state.rng
  for (let i = pool.length - 1; i > 0; i--) {
    const r = nextU32(rng)
    rng = r.state
    const j = r.value % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const choices = pool.slice(0, 3)

  const dialog = {
    title: 'Grim the Wanderer',
    body: 'He sets his wares down and nods.',
    actions: choices.map(cardId => ({
      label: getCard(cardId).name,
      resolve: { type: 'MerchantTrade' as const, cardId, merchantId: merchant.id },
    })),
  }

  return { ...state, rng, pendingDialog: dialog }
}
```

**`merchantTrade` reducer:**
```ts
export function merchantTrade(state: World, action: Extract<Action, { type: 'MerchantTrade' }>): World {
  const merchant = state.actors[action.merchantId]
  if (!merchant || merchant.kind !== 'npc') return state
  const actors = { ...state.actors }
  delete actors[action.merchantId]
  return {
    ...state,
    actors,
    turnOrder: state.turnOrder.filter(id => id !== action.merchantId),
    run: {
      ...state.run,
      cards: {
        ...state.run.cards,
        deck: [...state.run.cards.deck, action.cardId],
      },
    },
  }
}
```

**Tests — `tests/core/reducers/merchant.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import type { Actor, World } from '../../../src/core/types'

function withMerchant(seed: string): World {
  const base = createInitialWorld(seed)
  const heroPos = base.actors[base.heroId].pos
  const merchant: Actor = {
    id: 'merchant-d2',
    kind: 'npc',
    archetype: 'merchant',
    pos: { x: heroPos.x + 1, y: heroPos.y },
    hp: 1, maxHp: 1, atk: 0, def: 0,
    alive: true,
    statusEffects: [],
  }
  return {
    ...base,
    actors: { ...base.actors, [merchant.id]: merchant },
    turnOrder: [...base.turnOrder, merchant.id],
  }
}

describe('merchant interaction', () => {
  it('OpenMerchantDialog sets pendingDialog with 3 card choices', () => {
    const state = withMerchant('m-1')
    const next = dispatch(state, { type: 'OpenMerchantDialog', merchantId: 'merchant-d2' })
    expect(next.pendingDialog).not.toBeNull()
    expect(next.pendingDialog!.actions.length).toBe(3)
  })

  it('MerchantTrade adds card to deck and removes merchant', () => {
    const state = withMerchant('m-2')
    const before = state.run.cards.deck.length
    const next = dispatch(state, { type: 'MerchantTrade', cardId: 'heal', merchantId: 'merchant-d2' })
    expect(next.actors['merchant-d2']).toBeUndefined()
    expect(next.turnOrder.includes('merchant-d2')).toBe(false)
    expect(next.run.cards.deck.length).toBe(before + 1)
    expect(next.run.cards.deck[next.run.cards.deck.length - 1]).toBe('heal')
  })

  it('interact click on NPC sets interact intent', async () => {
    const { intentForClick } = await import('../../../src/input/intent')
    const state = withMerchant('m-3')
    const npcPos = state.actors['merchant-d2'].pos
    const action = intentForClick(state, npcPos)
    expect(action).toEqual({ type: 'SetHeroIntent', intent: { kind: 'interact', targetId: 'merchant-d2' } })
  })
})
```

**Verification:**

- [ ] **Step 1: Implement all edits above.**

- [ ] **Step 2: Merchant tests.**
Run: `bun test tests/core/reducers/merchant.test.ts`
Expected: 3 pass.

- [ ] **Step 3: Full suite + typecheck.**
Run: `bun test && bun run typecheck`

- [ ] **Step 4: Commit.**
```bash
git add src/content/archetypes.json src/core/state.ts src/core/reducers/descend.ts src/core/reducers/dialog.ts src/input/intent.ts src/ai/heroAuto.ts tests/core/reducers/merchant.test.ts
git commit -m "feat: merchant NPC spawn, click-to-interact, trade flow"
```

---

### T9: Lore scrolls — procgen + render + pickup

**Files:**
- Modify: `src/procgen/floor.ts` (place 1 scroll per floor)
- Modify: `src/core/reducers/descend.ts` (reset scrolls, add fresh)
- Modify: `src/core/state.ts` (init floor-1 scroll)
- Modify: `src/core/reducers/move.ts` (pickup side-effect)
- Modify: `src/render/world.ts` (render scrolls)
- Create: `tests/core/reducers/scroll.test.ts`

**`floor.ts` addition** — `generateFloor` already consumes spawn tiles. Add scroll placement as a new returned field OR via an exported helper. Cleaner: `generateFloor` returns `{ floor, rng, scrollPos }` where scrollPos is a random floor-interior tile not equal to any spawn and not the stairs. Caller (createInitialWorld/descend) combines scrollPos with a fragmentIndex derived from depth to build the `LoreScroll`.

```ts
// in generateFloor, after picking spawns and stairs:
let scrollPos: Pos | null = null
const candidates: Pos[] = []
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (tiles[y * width + x] !== Tile.Floor) continue
    if (spawns.some(s => s.x === x && s.y === y)) continue
    candidates.push({ x, y })
  }
}
if (candidates.length > 0) {
  const r = nextU32(rng); rng = r.state
  scrollPos = candidates[r.value % candidates.length]
}
return { floor: { width, height, tiles, spawns }, rng, scrollPos }
```

Update the return type of `generateFloor`. Callers must pull `scrollPos`.

**`state.ts` — `createInitialWorld`** — after destructuring `generateFloor`, build a scroll from scrollPos + fragmentIndex=0:
```ts
const loreScrolls: LoreScroll[] = scrollPos
  ? [{ id: `scroll-d1`, pos: scrollPos, fragmentIndex: 0 }]
  : []
// include in the returned World
```

**`descend.ts` additions** — after generating the new floor:
```ts
const loreScrolls: LoreScroll[] = !isBossFloor && scrollPos
  ? [{ id: `scroll-d${newDepth}`, pos: scrollPos, fragmentIndex: newDepth - 1 }]
  : []
// include in returned world; also clear pendingDialog
```

Descend's return object gets `loreScrolls`, `pendingDialog: null`.

**`move.ts` — scroll pickup side-effect** — inside `moveActor`, after the item pickup block:
```ts
// Scroll pickup — hero only
if (actor.id === state.heroId) {
  const scrollHere = state.loreScrolls.find(s => s.pos.x === action.to.x && s.pos.y === action.to.y)
  if (scrollHere) {
    const fragment = getLoreFragment(scrollHere.fragmentIndex)
    const loreScrolls = state.loreScrolls.filter(s => s.id !== scrollHere.id)
    return {
      ...stateWithMove, // whatever state you've built so far (with droppedItems pickup etc.)
      loreScrolls,
      pendingDialog: {
        title: fragment.title,
        body: fragment.body,
        actions: [{ label: 'Onward.', resolve: null }],
      },
    }
  }
}
```

Integrate cleanly with the existing flask pickup logic (may need restructuring — build a single "after move" state mutation that handles items + scrolls). Add import:
```ts
import { getLoreFragment } from '../../content/loreLoader'
```

**`world.ts` (render)** — after the items loop, render scrolls similarly:
```ts
if (atlasReady) {
  const bob = Math.sin(performance.now() / 400) * tileSize * 0.08
  for (const scroll of state.loreScrolls) {
    if (!posVisible(scroll.pos.x, scroll.pos.y)) continue
    const cx = scroll.pos.x * tileSize + tileSize / 2
    const cy = scroll.pos.y * tileSize + tileSize / 2 + bob
    drawSprite(ctx, 'scroll', cx, cy, tileSize)
  }
}
```

**Tests — `tests/core/reducers/scroll.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'

describe('scroll pickup', () => {
  it('initial world has exactly one lore scroll', () => {
    const w = createInitialWorld('scroll-1')
    expect(w.loreScrolls.length).toBe(1)
    expect(w.loreScrolls[0].fragmentIndex).toBe(0)
  })

  it('hero stepping on a scroll removes it and opens dialog', () => {
    const base = createInitialWorld('scroll-2')
    const heroId = base.heroId
    const hero = base.actors[heroId]
    const scrollPos = { x: hero.pos.x + 1, y: hero.pos.y }
    // Force the scroll to be adjacent to hero for the test
    const state = { ...base, loreScrolls: [{ id: 'scroll-test', pos: scrollPos, fragmentIndex: 0 }] }
    const next = dispatch(state, { type: 'MoveActor', actorId: heroId, to: scrollPos })
    expect(next.loreScrolls.length).toBe(0)
    expect(next.pendingDialog).not.toBeNull()
    expect(next.pendingDialog!.title.length).toBeGreaterThan(0)
  })
})
```

**Verification:**

- [ ] **Step 1: Implement.**

- [ ] **Step 2: Scroll tests.**
Run: `bun test tests/core/reducers/scroll.test.ts`
Expected: 2 pass.

- [ ] **Step 3: Full suite (existing floor tests may need adjustment if generateFloor signature changed).**
Run: `bun test && bun run typecheck`

- [ ] **Step 4: Commit.**
```bash
git add src/procgen/floor.ts src/core/state.ts src/core/reducers/descend.ts src/core/reducers/move.ts src/render/world.ts tests/core/reducers/scroll.test.ts
git commit -m "feat: lore scroll procgen + pickup + render"
```

---

### T10: Shrines — tile + procgen + walkability + resolution

**Files:**
- Modify: `src/procgen/floor.ts` (25% shrine placement)
- Modify: `src/ai/pathfind.ts` (Shrine walkable)
- Modify: `src/input/intent.ts` (Shrine walkable)
- Modify: `src/core/reducers/move.ts` (step-onto-shrine emits dialog)
- Modify: `src/core/reducers/dialog.ts` (fill `resolveShrine`)
- Modify: `src/render/world.ts` (draw shrine glyph)
- Create: `tests/procgen/shrine.test.ts`
- Create: `tests/core/reducers/shrine.test.ts`

**`floor.ts` — shrine placement:**
```ts
// After placing stairs (but before returning), roll for shrine:
const shrineRoll = nextFloat(rng); rng = shrineRoll.state
if (shrineRoll.value < 0.25) {
  // Reuse the scroll candidate list if convenient, or recompute:
  const shrineCandidates = candidates.filter(p =>
    tiles[p.y * width + p.x] === Tile.Floor &&
    !spawns.some(s => s.x === p.x && s.y === p.y) &&
    !(scrollPos && scrollPos.x === p.x && scrollPos.y === p.y)
  )
  if (shrineCandidates.length > 0) {
    const pick = nextU32(rng); rng = pick.state
    const sp = shrineCandidates[pick.value % shrineCandidates.length]
    tiles[sp.y * width + sp.x] = Tile.Shrine
  }
}
```

**`pathfind.ts` change** — update the walkability predicate (both in `firstStepToward` and `fullPathToward`):
```ts
const t = floor.tiles[y * w + x]
if (t !== Tile.Floor && t !== Tile.Stairs && t !== Tile.Shrine) return false
```

**`intent.ts` change** — in the final walkable check:
```ts
const t = floor.tiles[tile.y * floor.width + tile.x]
if (t === Tile.Floor || t === Tile.Stairs || t === Tile.Shrine) {
  return { type: 'SetHeroIntent', intent: { kind: 'move-to', goal: tile } }
}
```

**`move.ts` — update isWalkable:**
```ts
function isWalkable(state: World, p: Pos): boolean {
  const { floor } = state
  if (p.x < 0 || p.y < 0 || p.x >= floor.width || p.y >= floor.height) return false
  const t = floor.tiles[p.y * floor.width + p.x]
  return t === Tile.Floor || t === Tile.Stairs || t === Tile.Shrine
}
```

**`move.ts` — shrine step side-effect** — after the scroll pickup block:
```ts
if (actor.id === state.heroId) {
  const t = state.floor.tiles[action.to.y * state.floor.width + action.to.x]
  if (t === Tile.Shrine) {
    return {
      ...stateAfterMove,
      pendingDialog: {
        title: 'An altar hums.',
        body: 'Blood from the bowl, or breath from the flame?',
        actions: [
          { label: 'Blood', resolve: { type: 'ResolveShrine', choice: 'blood', pos: action.to } },
          { label: 'Breath', resolve: { type: 'ResolveShrine', choice: 'breath', pos: action.to } },
        ],
      },
    }
  }
}
```

**`resolveShrine` reducer (in `dialog.ts`):**
```ts
export function resolveShrine(state: World, action: Extract<Action, { type: 'ResolveShrine' }>): World {
  const heroId = state.heroId
  const hero = state.actors[heroId]
  if (!hero) return state

  // Apply stat change
  let nextHero = hero
  if (action.choice === 'blood') {
    nextHero = { ...hero, maxHp: hero.maxHp + 2, hp: hero.hp + 2 }
  } else {
    nextHero = { ...hero, atk: hero.atk + 1 }
  }

  // Convert shrine tile to floor
  const newTiles = new Uint8Array(state.floor.tiles)
  newTiles[action.pos.y * state.floor.width + action.pos.x] = Tile.Floor

  return {
    ...state,
    actors: { ...state.actors, [heroId]: nextHero },
    floor: { ...state.floor, tiles: newTiles },
  }
}
```

**`world.ts` — render Shrine** — in the tile render loop, add a branch:
```ts
} else if (t === Tile.Shrine) {
  if (atlasReady) {
    drawTileSprite(ctx, 'floor_1', x, y, tileSize)
  } else {
    ctx.fillStyle = palette.deepPurpleLite
    ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1)
  }
  // Draw a vertical amber pillar glyph centered on the tile.
  ctx.fillStyle = palette.silkFlameAmber
  const cx = x * tileSize + tileSize / 2
  const top = y * tileSize + Math.floor(tileSize * 0.2)
  const h = Math.floor(tileSize * 0.6)
  const w = Math.floor(tileSize * 0.25)
  ctx.fillRect(cx - Math.floor(w / 2), top, w, h)
  ctx.fillStyle = palette.bloodCrimson
  const flameY = top + Math.floor(Math.sin(performance.now() / 300) * 2)
  ctx.beginPath()
  ctx.arc(cx, flameY, Math.floor(tileSize * 0.12), 0, Math.PI * 2)
  ctx.fill()
}
```

**Tests — `tests/procgen/shrine.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { generateFloor } from '../../src/procgen/floor'
import { createRng } from '../../src/core/rng'
import { Tile } from '../../src/core/types'

describe('shrine procgen', () => {
  it('places exactly 0 or 1 shrine tiles per floor across 200 seeds', () => {
    let withShrine = 0
    const N = 200
    for (let i = 0; i < N; i++) {
      const { floor } = generateFloor(createRng(`shrine-${i}`), 40, 30)
      let count = 0
      for (let j = 0; j < floor.tiles.length; j++) {
        if (floor.tiles[j] === Tile.Shrine) count++
      }
      expect(count).toBeLessThanOrEqual(1)
      if (count === 1) withShrine++
    }
    // Expect ~25% ±8% (loose bound)
    expect(withShrine).toBeGreaterThan(N * 0.15)
    expect(withShrine).toBeLessThan(N * 0.35)
  })
})
```

**Tests — `tests/core/reducers/shrine.test.ts`:**
```ts
import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'
import { Tile } from '../../../src/core/types'

describe('shrine resolve', () => {
  it('blood grants +2 maxHp and +2 hp', () => {
    const base = createInitialWorld('shrine-b')
    const hero = base.actors[base.heroId]
    const pos = hero.pos // irrelevant for stat change
    const next = dispatch(base, { type: 'ResolveShrine', choice: 'blood', pos })
    expect(next.actors[base.heroId].maxHp).toBe(hero.maxHp + 2)
    expect(next.actors[base.heroId].hp).toBe(hero.hp + 2)
  })

  it('breath grants +1 atk', () => {
    const base = createInitialWorld('shrine-r')
    const hero = base.actors[base.heroId]
    const pos = hero.pos
    const next = dispatch(base, { type: 'ResolveShrine', choice: 'breath', pos })
    expect(next.actors[base.heroId].atk).toBe(hero.atk + 1)
  })

  it('converts shrine tile to floor after resolve', () => {
    const base = createInitialWorld('shrine-convert')
    // Force a shrine at a known tile
    const pos = { x: 5, y: 5 }
    const newTiles = new Uint8Array(base.floor.tiles)
    newTiles[pos.y * base.floor.width + pos.x] = Tile.Shrine
    const state = { ...base, floor: { ...base.floor, tiles: newTiles } }
    const next = dispatch(state, { type: 'ResolveShrine', choice: 'blood', pos })
    expect(next.floor.tiles[pos.y * next.floor.width + pos.x]).toBe(Tile.Floor)
  })
})
```

**Verification:**

- [ ] **Step 1: Implement.**

- [ ] **Step 2: Shrine tests.**
Run: `bun test tests/procgen/shrine.test.ts tests/core/reducers/shrine.test.ts`
Expected: 4 pass.

- [ ] **Step 3: Full suite + typecheck.**
Run: `bun test && bun run typecheck`

- [ ] **Step 4: Commit.**
```bash
git add src/procgen/floor.ts src/ai/pathfind.ts src/input/intent.ts src/core/reducers/move.ts src/core/reducers/dialog.ts src/render/world.ts tests/procgen/shrine.test.ts tests/core/reducers/shrine.test.ts
git commit -m "feat: shrine tile — procgen placement, walkability, resolve action"
```

---

## Wave 4 — Integration + manual smoke (serial, 2 tasks)

### T11: Minimap + dev-log recognize shrines/scrolls

**Files:**
- Modify: `src/ui/minimap.ts` (draw shrine tiles + scroll markers)
- Modify: (optional) nothing else if minimap's `Tile.*` branches already handle by-index; check.

Update `minimap.ts`'s tile-color switch to include Shrine and add a pass for `loreScrolls`:
```ts
else if (t === Tile.Shrine) color = palette.bloodCrimson
// ...
// After items loop, scrolls:
for (const scroll of state.loreScrolls) {
  const idx = scroll.pos.y * floor.width + scroll.pos.x
  if (!everythingVisible && !seenTiles![idx]) continue
  ctx.fillStyle = palette.silkFlameAmber
  ctx.fillRect(scroll.pos.x * MINIMAP_SCALE, scroll.pos.y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE)
}
```

**Verification:**

- [ ] **Step 1: Edit `minimap.ts`.**

- [ ] **Step 2: Typecheck + build.**
```bash
bun run typecheck && bun run build
```

- [ ] **Step 3: Commit.**
```bash
git add src/ui/minimap.ts
git commit -m "feat(ui): minimap shows shrines and scrolls"
```

---

### T12: Full integration + README update + smoke checklist

**Files:**
- Modify: `README.md` (add Phase 1D section)

**README additions:**
```markdown
## Phase 1D — Narrative & content

Spec: `docs/plans/2026-04-18-phase-1d-design.md`.
Plan: `docs/plans/2026-04-18-phase-1d-plan.md`.

- **NPC — Grim the Wanderer.** Merchant appears on floors 2 and 4 near
  hero spawn. Click to approach; adjacency opens a 3-card trade modal.
- **Lore scrolls.** One per non-boss floor, placed on a random floor tile.
  Step onto it to read a fragment; no codex — read once, gone.
- **Shrines.** ~25% of non-boss floors have a shrine tile. Stand on it
  to choose Blood (+2 maxHp) or Breath (+1 atk).
- **3 new cards:** Greater Heal (heal 12), Fortify (+2 DEF / 6 ticks),
  Vigor (+3 ATK / 3 ticks).

Dialog UX: any NPC / scroll / shrine interaction opens a centered modal.
Card hand and other UI remain visible but non-interactive while the
modal is up.
```

**Manual smoke checklist (for the user):**
1. Fresh run — hp=20, floor 1. A scroll is placed somewhere on the map; walk onto it → lore modal.
2. Dismiss modal → continues.
3. Kill all enemies on floor 1 → card reward modal (unchanged).
4. Descend to floor 2 → merchant appears near hero spawn. Click merchant → hero walks adjacent → modal with 3 cards. Pick one → card added to deck; merchant vanishes.
5. Some floors have a shrine; walk onto it → modal → pick Blood or Breath → stat updates visibly in HUD.
6. Refresh mid-run → auto-resume preserves scrolls/shrines/merchant state.
7. Boss floor (5) — no merchant, no scroll, no shrine. Win condition unchanged.

**Verification:**

- [ ] **Step 1: Update README.**

- [ ] **Step 2: Run full suite + build.**
```bash
bun test && bun run typecheck && bun run build
```
Expected: all green, build clean.

- [ ] **Step 3: Manual smoke pass** (user runs dev server + follows checklist).

- [ ] **Step 4: Commit.**
```bash
git add README.md
git commit -m "docs: phase 1d readme + smoke checklist"
```

---

## Dispatch notes

- **Wave 1 (T1 → T2 → T3)** strictly serial. T2 depends on T1's Action types; T3 depends on T2 existing.
- **Wave 2 (T4, T5, T6)** touch disjoint files. Full parallel.
- **Wave 3:**
  - T7 touches `attack.ts`, `planner.ts`, `chase.ts`. T8 touches `dialog.ts`, `intent.ts`, `heroAuto.ts`, `archetypes.json`, `state.ts`, `descend.ts`. T9 touches `floor.ts`, `state.ts`, `descend.ts`, `move.ts`, `world.ts`. T10 touches `floor.ts`, `pathfind.ts`, `intent.ts`, `move.ts`, `dialog.ts`, `world.ts`.
  - **Conflict sites:** `state.ts` (T8, T9), `descend.ts` (T8, T9), `move.ts` (T9, T10), `floor.ts` (T9, T10), `intent.ts` (T8, T10), `dialog.ts` (T8, T10), `world.ts` (T9, T10).
  - **Dispatch strategy:** run T7 in parallel (disjoint). Run T8 → T9 → T10 **serially** to avoid merge complexity. Total: 4 tasks, 3 with light ordering.
- **Wave 4 (T11 → T12)** serial.

**Estimate:** 12 tasks, ~3 hours wall clock with one subagent at a time (T8/T9/T10 serialization means less parallel upside than 1C).

## Success criterion

All items in the spec's "Success criteria" section pass. Merge to master via the `git reset --hard feat/phase-1d` bypass pattern (user already approved this).
