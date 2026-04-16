# Skull Empires Revived — Design Spec

**Date:** 2026-04-17
**Owner:** kashik0i
**Status:** Approved for planning
**Repo:** github.com/kashik0i/skull-empires-revived

## 1. Vision

A browser-based, gesture-and-voice-controlled, director-style roguelike. Aesthetic cue from Gurk III (simplicity, push-button spirit), gameplay shape entirely different: the world runs itself (~80%), and the player shapes outcomes (~20%) by pointing, pausing, whispering to NPCs, and playing divine-intervention cards.

This is a personal portfolio / experimentation project, not AAA. The goal is to try novel things (LLM-driven NPCs in-browser, hand-gesture controls, voice dialog) while shipping something playable early and iterating.

## 2. Phasing

Each phase ships playable and standalone. No phase is a hard dependency for the next to be useful.

- **Phase 1 — Playable Skeleton.** Rule-based autopilot, scripted NPC dialog, gestures + voice controls, single-player, roguelike runs. No LLM.
- **Phase 2 — LLM Mind.** WebLLM (primary) + BYO-API-key (fallback) behind a `Planner` interface. LLM drives hero auto-pilot reasoning and NPC dialog. Scripted tables remain as fallback.
- **Phase 3 — Multiplayer.** WebRTC action-log sync, 2-4 directors co-shaping one world, voice chat between players.

This document covers Phase 1 in depth and Phases 2-3 in enough detail to avoid architectural dead-ends.

## 3. Gameplay shape

### Session
- **Roguelike runs**, ~15-30 min each.
- Procedural world per run. Permadeath. Each run is an emergent story.
- 5-8 procedurally generated floors, culminating in a boss ("the Skull Emperor").
- Between floors: pick 1 of 3 offered divine-intervention cards.

### Setting
- **Dark-fantasy undead** — necromancer kings, skeletal legions, cursed relics. Somber palette, bone-and-iron motifs.

### Aesthetic
- **Stylized flat / vector.** Not pixel art. Bone-white silhouettes on deep purples, silk-flame particles, moody tone.
- Sprites drawn procedurally from per-archetype recipes (silhouette body + accent strip + head dot). Palette-swappable. No spritesheets.
- Animations via tweens (squash-stretch walks, lunge-recoil attacks). "Cool animation" payoff concentrated in the FX layer (particles, screen effects) applied to dramatic moments (crits, card plays, deaths).

### Combat
- **Turn-based.** Player intervenes between turns (point, pause, whisper, card).
- Initiative queue in state. Each turn: planner decides action for current actor, reducer applies, FX fires.

### Director's toolkit (Phase 1)
- **① Point-and-suggest** — point a finger at a tile/NPC/item; emits a non-binding hint the party's planner reads as a high-weight goal.
- **② Pause / slow / speed time** — open palm pauses, peace-sign cycles 0.5× / 1× / 2×.
- **④ Whisper-to-NPC** — push-to-talk + point at NPC opens a dialog session; Phase 1 uses scripted response tables, Phase 2 LLM completion.
- **⑤ Divine intervention cards** — a small deck of limited-use powers (bless, curse, storm, reveal-map, heal, spawn-helper, etc). Hand is opened with a pinch, a card is played with a fist on that card (+ point at target if card is targeted).

**Deferred to later phases:** hero possession, open-ended quest-setting, reroll/fate-nudge, multiplayer.

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      BROWSER TAB                             │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Input Layer │    │ Render Layer │    │  Voice Layer  │  │
│  │              │    │              │    │               │  │
│  │ MediaPipe →  │    │ Canvas 2D +  │    │ Web Speech +  │  │
│  │ Gesture      │    │ tween engine │    │ push-to-talk  │  │
│  │ classifier   │    │ (world + FX) │    │ gesture       │  │
│  └──────┬───────┘    └──────▲───────┘    └──────┬────────┘  │
│         │                    │                   │           │
│         │    Intent          │  State            │ Utterance │
│         ▼                    │                   ▼           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    GAME CORE (pure TS)                  ││
│  │                                                         ││
│  │   Intent → Action → Reducer → State′ → Log → State      ││
│  │                                                         ││
│  │   ┌────────────┐  ┌──────────┐  ┌────────────────┐      ││
│  │   │ Reducers   │  │ AI (Sim) │  │ Content /      │      ││
│  │   │ (domain)   │  │ turn-    │  │ Procgen        │      ││
│  │   │            │  │ planner  │  │ (maps, drops)  │      ││
│  │   └────────────┘  └──────────┘  └────────────────┘      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  [ Phase 2: LLM Adapter sits between AI Planner and Core ]   │
│  [ Phase 3: Transport (WebRTC) ships action log peer-peer ]  │
└──────────────────────────────────────────────────────────────┘
```

### Principles

1. **Core is pure TypeScript.** No DOM, no canvas, no audio, no fetch. `reducer(state, action) → state'`. Unit-testable in Bun.
2. **Everything else is a thin adapter.** Input → intents → actions; state → draw calls; voice utterance → whisper-action.
3. **The action log is the source of truth.** Replay, rewind, and multiplayer sync all derive from it.
4. **Determinism.** Seeded PRNG lives inside state; procgen, combat rolls, card effects all draw from it. Same seed + same action log = same run, forever.
5. **Phase boundaries are module swaps.** Phase 2's LLM adapter *replaces* the rule-based AI planner behind the same interface; no core changes.

### Module layout

```
src/
  core/          # pure TS: state, actions, reducers, rng, selectors
  ai/            # rule-based turn planner (Phase 1) / LLM (Phase 2)
  procgen/       # map, encounter, loot generation from seed
  content/       # static data: monsters, items, cards, dialog
  input/
    gesture/     # MediaPipe wrapper + gesture classifier (Worker)
    voice/       # Web Speech wrapper + command grammar
    dev/         # ?dev=1 mouse+keyboard adapter
  render/
    world/       # canvas 2D tile + unit drawing
    fx/          # particle system, screen shaders, card animations
    ui/          # HUD, menus (DOM)
  app/           # bootstrap, game loop, wiring
```

## 5. State model

Single serializable state tree. Readable enough to drop into a Phase 2 LLM prompt as-is.

```ts
type World = {
  seed: string
  tick: number
  phase: 'exploring' | 'combat' | 'dialog' | 'paused' | 'run_over'
  timeScale: 0 | 0.5 | 1 | 2

  run: {
    depth: number
    deaths: number
    goal: Goal | null
  }

  floor: {
    width: number
    height: number
    tiles: Uint8Array
    explored: Uint8Array
    features: Feature[]
  }

  actors: Record<ActorId, Actor>
  party: ActorId[]
  turnOrder: { queue: ActorId[], current: ActorId | null }

  inventory: Item[]
  cards: { hand: CardId[], deck: CardId[], discard: CardId[] }

  dialog: DialogSession | null
  log: LogEntry[]

  rng: RngState
}

type Actor = {
  id: ActorId
  kind: 'hero' | 'npc' | 'enemy'
  archetype: string
  pos: { x: number, y: number }
  hp: number; maxHp: number
  stats: { atk: number, def: number, spd: number, will: number }
  status: StatusEffect[]
  behavior: BehaviorState   // AI planner scratchpad
  intent: Intent | null     // director's "point" nudges
}
```

### Design calls
- **Flat `Uint8Array` tile grid** — cheap to snapshot, serialize for LLM, and render.
- **`behavior`** is the planner's scratchpad. Phase 1: small state machine (`patrol` / `attack` / `flee`). Phase 2: LLM-chosen-action + short memory. Schema is shared.
- **`intent`** is a non-binding hint from the director. Planner reads it and weights goals accordingly.
- **`rng`** lives in state. No `Math.random()` anywhere in core.
- **`log`** is a rolling buffer (N≈50) of human-readable events. Feeds HUD scroll and Phase 2 LLM context.
- **`cards`** mirrors a deck-builder (hand / deck / discard).

### Deliberately NOT in state
- Camera / viewport / selected UI tab (render-layer ephemeral).
- Animation progress (FX layer owns its own tweens).
- Audio state.

## 6. Data flow (one turn)

**A. Sim tick (continuous, ~60Hz).** Render loop reads state, draws tiles + actors + FX. If `phase === 'paused'` or `timeScale === 0`, no sim advances; FX tweens still play.

**B. Player intent arrives.** Either:
1. Gesture worker (MediaPipe in a `Web Worker`) emits a classified gesture → intent mapper resolves against state.
2. Voice — `shoulderRaise` gesture opens mic; utterance → Web Speech → grammar match → whisper intent.

**C. Action dispatched.**
```
dispatch(action) →
  state' = reducer(state, action)
  log.append(action)
  diff = diffEvents(state, state')
  fx.emit(diff)
  audio.emit(diff)
  renderDirty = true
```

**D. Turn advance.** When combat/action is due (timer + timeScale), the loop asks the AI planner for the current actor's next action: `planner.decide(state, actorId) → Action`. Phase 1 = rule function. Phase 2 = LLM call with cached state snapshot.

**E. Dialog / whisper.** Opens a modal-ish `DialogSession` in state. Voice utterances become `DialogUtter` actions. Phase 1 = keyword-matched scripted responses; Phase 2 = LLM completion bounded by the NPC's persona + world state + recent log.

**F. End of run.** Party wipe → `RunEnd` → `phase: 'run_over'`. Action log + seed saved to `localStorage` under a short run ID for replay/share/debug.

**Non-obvious invariant:** all input paths produce actions. There is no side-effect channel. Every render update, audio event, log entry, and (Phase 2) LLM call is downstream of a state change. This is what makes pause/rewind/replay/multiplayer work by construction, not by retrofit.

## 7. Input layer

### Gesture recognition

Pipeline:
```
Webcam → Worker (MediaPipe Hands) → landmarks @ 30fps
       → GestureClassifier (stateful, hysteresis)
       → GestureEvent {type, meta, confidence, stableFor}
       → IntentMapper (reads game state)
       → Intent
```

Keeping MediaPipe in a Worker preserves 60fps rendering and isolates GPU cost.

**Phase 1 classifier (hand-written over landmark geometry):**
- `pointIndex` — index extended, others curled.
- `openPalm` — all five extended, palm normal toward camera.
- `fist` — all fingertip-to-MCP distances below threshold.
- `pinch` — thumb-tip / index-tip distance below threshold.
- `peace` — index + middle extended, others curled.
- `shoulderRaise` — wrist Y above a calibrated threshold (approximation; refined during implementation).

Every gesture must be `stableFor >= 150ms` before firing to reject noise. `pointIndex` emits continuously while held (position updates).

**Calibration screen** (one-time on first load): show each gesture, record per-user thresholds to `localStorage`.

**Intent mapping (Phase 1):**

| Gesture                          | Default Intent                                                |
|---                               |---                                                            |
| `point` at tile                  | `HintMove` / `HintAttack` / `HintInteract` on target          |
| `openPalm`                       | `TogglePause`                                                 |
| `peace`                          | `CycleTimeScale` (1× → 2× → 0.5×)                             |
| `pinch`                          | `OpenCardHand` / `CloseCardHand`                              |
| `fist` on card in hand           | `PlayCard` (target inferred from simultaneous point if any)   |
| `shoulderRaise` (hold)           | `PushToTalk`                                                  |

### Voice

**Engine:** Web Speech API (Chromium). Graceful degradation elsewhere.

**Phase 1 grammar (keyword-matched):**
```
verbs:   talk | attack | cast | use | stop | retreat | rest | flee
targets: him | her | them | that | the <archetype> | ...
```
Utterance → regex + keyword table → `Intent`. No match → HUD flash + discard.

**Dialog mode:** enter via `PushToTalk` + point at NPC. NPC faces you. Transcript UI updates as you speak. On release, transcript lands as `DialogUtter`. Phase 1: scripted response table keyed by intent keywords + NPC archetype. Phase 2: LLM completion.

### `?dev=1` fallback

- Left-click tile = point intent.
- `Space` = pause.
- `1-5` = play card N.
- `Tab` = cycle time scale.
- Hold `T` = push-to-talk (still voice, just a key trigger).
- Click NPC while holding `T` = dialog.

Developer ergonomics AND accessibility in one switch. Production builds ship it behind a settings toggle.

### Permission & onboarding

- First load: one-screen explainer ("this game uses camera and mic"). Options: *Grant & continue* / *Use dev controls*.
- Camera denied → auto-fallback to `?dev=1`.
- Mic denied → NPC dialog becomes click-to-choose menu.
- Firefox: gestures work, voice is patchy → menu-based dialog auto-enabled.
- Safari: weakest target; best-effort, not a blocker.
- Mic is only active during `PushToTalk`. Never listening ambiently.

## 8. Rendering

Two canvases + a DOM overlay. Canvas 2D is sufficient for Phase 1.

**Layer stack (back-to-front):**
1. **`world` canvas** — tiles, actors, features. Drawn only when state is dirty. Camera lerps to party centroid.
2. **`fx` canvas** — particles, 2D shader effects (channel-offset chromatic aberration, flash whites, screen shake, ground cracks). Always animating.
3. **DOM `ui`** — HUD (time-scale, card hand, log scroll, dialog transcript, mic/gesture indicators). Regular HTML/CSS — easier to style, easier for a11y.

**FX system:**
- Subscribes to state diffs from the dispatch loop.
- Each diff type maps to one or more `FxEmitter` presets.
- Card effects are first-class data: each card's JSON includes its `fx` spec (a scripted emitter sequence + screen effects). Adding a new card = data row + fx entry. No code change.

**Flat-vector style concretely:**
- Tiles: solid color fills + optional noise overlay + border.
- Actors: stacked procedural shapes per archetype recipe. Palette-swappable.
- Walks: squash-stretch tween. Attacks: lunge-and-recoil. Deaths: fade-scale-down + skull particle spew.
- One UI font (undead-feeling serif, e.g. UnifrakturMaguntia).

**Perf budget:** world redraw ≤ 2ms on a mid-range laptop; FX canvas 60fps with ~200 particles; gesture worker off-main-thread.

**Why not WebGL/Pixi in Phase 1:** scope. Canvas 2D is enough at this aesthetic. A WebGL FX layer can drop in behind `fx` later without touching core or world.

## 9. Procgen & content

### Map generation (per floor)
- Seeded from `world.seed + depth`.
- **BSP dungeons** (binary space partition → rooms → corridors). Battle-tested, easy to tune (deeper floors = tighter corridors, more rooms).
- Features placed after: stairs, 1-2 chests, 0-2 shrines, 1 "whisper candidate" NPC.

### Encounters
- Each floor has a `power budget` scaling with depth.
- Draws archetypes from a weighted table until budget spent.
- Placed in rooms; patrol routes set along room perimeters.

### Loot
- Static item pool (~30 items), tagged by rarity + depth.
- Chests roll from tag-filtered pool via seeded RNG.
- Card deck grows between floors (pick 1 of 3).

### Content-as-data
```
content/
  archetypes.json     # stats, behavior template, fx recipe, sprite recipe
  items.json          # slot, tags, effects as action-generators
  cards.json          # cost, target rules, effect actions, fx spec
  dialog/
    bone-knight.json  # keyword → response table (Phase 1)
    ...
```
Adding a new enemy / item / card = edit JSON + reload. Phase 2 can procedurally propose NPC dialog via LLM using the JSON persona as seed context.

**Phase 1 content floor:** 6 enemy archetypes, ~20 items, ~15 cards, 4-5 NPC archetypes. Enough variety without overwhelming asset work.

**Determinism guarantee:** `seed + depth` reconstructs a floor. `seed + action log` reconstructs an entire run.

## 10. Error handling

**Philosophy:** fail loud in dev, fail graceful in prod, never corrupt state.

1. **Core reducers are total functions.** Never throw. Invalid actions log a warning and return state unchanged. Invariants asserted behind a `DEV` flag only; prod clamps. TS discriminated-union action types make invalid shapes compile-time errors.
2. **Adapters isolate and degrade.**
   - Gesture worker crash → main thread catches via `worker.onerror`, toast "camera lost", auto-switch to `?dev=1` fallback.
   - Web Speech errors → utterance silently dropped with "unheard" mic cue. Never stalls game.
   - MediaPipe fails to load → same auto-fallback.
   - Permissions denied → fallback path, no mid-run modal.
3. **Persistence is atomic.** Auto-save (seed + action-log tail) to `localStorage` every N actions, wrapped in try/catch. Quota-exceeded shows a "save disabled" HUD badge; doesn't block play. On load failure mid-replay: stop at last good state, surface "partial load — continue from here?".
4. **Procgen never ships a broken floor.** Retry up to 10 times with reshuffled seed-variants for disconnected/too-small dungeons. If still failing: fall through to a bundled hand-authored emergency floor.
5. **FX are always non-fatal.** Bad particle spec or card fx script logs and skips. Gameplay continues.
6. **Phase 2 LLM:** timeout/error → planner falls back to Phase 1 rule-based decision. Malformed output (expected JSON action, got prose) → parse-retry once, then rule-fallback. Log for prompt tuning.

**Deliberately NOT doing:**
- No global error boundary that "recovers" by resetting state.
- No telemetry/error reporting in Phase 1. Console logs are enough for a personal project. Sentry-or-similar is Phase 3 territory.

## 11. Testing

**Core (Bun test, pure TS):**
- Reducer unit tests per action type.
- Full-run replay tests: load saved `seed + action log`, replay, snapshot final state. A small library of 3-5 canonical runs catches regressions.
- Procgen tests: bank of seeds → assert floors connected, stairs reachable, power budget respected.
- AI planner tests: fixed state → expected action.

**Adapters (Bun test + jsdom where needed):**
- Gesture classifier: fixed landmark JSON fixtures → asserted gesture output. No camera in CI.
- Voice grammar: fixed transcripts → asserted intents.
- Intent mapper: `(state, rawGesture) → expected Intent`.

**Integration / manual:**
- `?dev=1` mode is the manual test harness.
- `?record=1` flag saves session action log + seed as a downloadable `.runlog.json`. Share, replay deterministically.

**Type-checking gate:** `bun x tsc --noEmit` runs in pre-commit + CI. Bun's build step doesn't block on type errors by default.

**Not tested:**
- Canvas pixel output (tar pit).
- MediaPipe itself.
- Web Speech API.

## 12. Tooling & build

- **Runtime / package manager:** Bun.
- **Dev server:** Vite (`bun x vite`) for HMR. Drop-in replaceable with `bun build --watch` if toolchain feels heavy.
- **Language:** TypeScript throughout. Strict mode on.
- **Test runner:** `bun test` (replaces Vitest). `jsdom` where a DOM is needed.
- **Type-check:** `bun x tsc --noEmit` in pre-commit + CI.
- **Linting/formatting:** minimal. Prettier + a small ESLint config or `oxlint`.
- **Deploy:** GitHub Pages. CI uses `oven-sh/setup-bun@v1` + `bun install` + `bun x vite build` + publish.

## 13. Phasing (success criteria)

### Phase 1 — Playable Skeleton
Done when:
- A fresh visitor can grant camera/mic, complete calibration, and finish a full run (win or wipe) using only gestures + voice.
- A `?dev=1` player can complete the same run with mouse/keyboard.
- A shared run URL (`?seed=xyz&log=...`) deterministically replays on another machine.
- 60fps on a mid-range 2023 laptop.
- Content floor: 6 enemy archetypes, ~20 items, ~15 cards, 4-5 NPC archetypes.

### Phase 2 — LLM Mind
- WebLLM (primary) + BYO-API-key (fallback) behind the `Planner` interface.
- NPC dialog: scripted → LLM completion with persona + state + log context.
- Hero turn-planner: LLM call for heroes only (enemies stay rule-based for pace).
- Action-log snapshot = LLM memory per request.
- Settings toggle for direct A/B between "rules" and "LLM" modes.

### Phase 3 — Multiplayer
- WebRTC transport for action log sync.
- Host-authority model: one peer owns `rng` and planner calls; others apply the log.
- Voice chat between players piggybacks on mic permission.
- 2-4 humans co-direct one party with vote/priority rules for conflicting intents.
- Detailed design deferred until Phase 1 & 2 have shipped and shaped actual needs.

## 14. Open questions for implementation planning

These are intentionally not decided in the spec and are for the writing-plans phase:

- Party size (1 hero vs. small party of 2-3) — needs a prototype call once movement + combat exist.
- Exact PRNG (xorshift128+ vs sfc32) — any deterministic small-state generator is fine.
- FX library (hand-rolled particles vs. tiny dep like `@pixi/particles` adapted) — hand-rolled first, revisit if it becomes tedious.
- Audio layer — not in Phase 1 scope unless it comes cheap; revisit.
- Exact "Skull Empires" world-lore and NPC persona scripts — author during implementation.
