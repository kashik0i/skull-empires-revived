# Phase 1F — Layout Refresh, Music Polish, Mobile, Minimap Zoom, MIDI Export

**Status:** Design (approved 2026-04-18)
**Goal:** Move the HUD off the play canvas into a dedicated side panel. Make the procedural music feel alive (rhythm, bass, dynamic combat intensity). Add mobile support, a minimap zoom toggle, music playback controls, and MIDI export.

## Why

Phase 1E shipped inventory + items + a first procedural music pass, but every HUD widget still floats on top of the canvas. That has caused real bugs (clicks intercepted by the minimap, inventory crowding the bottom row of tiles) and looks cramped on small windows. A side-panel layout is the standard roguelike answer and physically separates UI from play.

The music is functional but thin — one triangle melody and a pad note every 8 beats. Adding bass + percussion + a combat-intensity layer turns it from "ambient noodling" into something that reacts to the run.

The other items (mobile, zoom toggle, music UI, MIDI export) are quality-of-life that the user explicitly pulled into scope this phase rather than backloging.

## Non-goals

- Reskin / new color palette.
- New gameplay mechanics. This phase is presentation + control surfaces only.
- Drag-and-drop inventory.
- Music sequencing editor.
- Streaming MIDI to other apps (export is download-only).
- Multi-touch gestures (pinch-zoom, etc.) — only single-tap.
- Landscape vs portrait orientation lock.
- Old-save replay compatibility (none of this changes World shape, so replays should keep working, but if anything breaks it's not a release blocker).

## Layout

### Desktop (>768px wide)

The `#stage` div becomes a CSS grid: `grid-template-columns: 1fr 280px`. Left cell is the canvas pair (`#world` + `#fx` stacked). Right cell is `#side-panel`, a vertical column holding HUD widgets in this order top→bottom:

1. **Minimap** — top of panel. Zoom toggle button below it (focused/full).
2. **HP bar + ATK/DEF/Depth stats** — moved from floating top-bar to here, styled as a stat block.
3. **Equipment slots** — weapon + armor side by side.
4. **Inventory grid** — 2 rows × 3 cols (was 1 row × 6). Same slot widget, restacked.
5. **Music controls** — play/pause toggle + volume slider.
6. **Descend button** — appears here when hero stands on stairs. Was a floating overlay; now a panel button.

Canvas resizes to its grid cell via `ResizeObserver`. We update `worldCanvas.width/height` to match its CSS pixel size on resize so the renderer keeps integer pixels.

`#hud` keeps `pointer-events: none` at root with `> * { pointer-events: auto }` so dialog/itemReward modals (still centered overlays) don't break.

Dialog + item-reward modals stay as centered overlays — they're modal blockers, not panel widgets.

### Mobile (≤768px wide)

The grid collapses to one column: canvas on top filling viewport-minus-drawer, HUD becomes a **bottom drawer** that's collapsible via a tap on its top edge.

Drawer states:
- `collapsed` — only a thin strip with HP bar + descend button (when active) is visible. Tap to expand.
- `expanded` — full HUD content visible, canvas height shrinks to fit. Tap header to collapse.

Default state: `expanded` on first mobile load. Subsequent state persists to `localStorage.hud_drawer` so a player who collapses keeps it collapsed.

Slot sizes bump to 56×56px on touch viewports (from 52). Inventory stays 2×3.

**Touch input:** mouse-click already handles tap on most browsers, but we add explicit `touchstart` → `click` translation on the canvas to remove the 300ms tap delay and prevent the default scroll-on-touch.

Breakpoint detection via `matchMedia('(max-width: 768px)')` — the layout reacts to resize so dragging a window across the breakpoint just works.

### Why a side panel and not a top/bottom strip?

A side panel keeps a 4:3 / square play area, which suits the dungeon view better than a wide-and-short letterbox. It also gives the inventory + equipment more vertical room to grow if Phase 1G adds more slots.

## Music

The current `createMusic` plays one triangle melody voice. We extend it to a small synth ensemble.

### Voices (always on)

1. **Melody** — triangle, exists today. Keep but make slightly less random (60% note chance, weighted toward lower scale degrees so it's less "twinkly").
2. **Bass** — sawtooth through a lowpass at 600 Hz. Plays root + fifth on the downbeat of each 4-beat bar, sustained for the bar.
3. **Arpeggio** — square wave at low gain. Runs 4 ascending scale notes per bar, every other bar.
4. **Percussion** — short noise bursts through bandpass filters: kick (low band, beats 1+3), hi-hat (high band, every offbeat). All on a separate gain bus so combat intensity can mix it.

### Combat intensity

Each music tick (every animation frame) reads `World.actors` and finds the nearest alive enemy to the hero. If `chebyshevDistance ≤ 3` we're in **combat** mood; else **explore**.

Mood affects:
- Tempo: explore = base bpm, combat = base bpm × 1.25.
- Percussion gain: explore = 0.3, combat = 0.7.
- Bass gain: explore = 0.4, combat = 0.6.
- Melody gain unchanged.

Transitions are smoothed via `setTargetAtTime` over 1 second to avoid abrupt shifts when an enemy walks into range.

### Boss floor (depth 5)

Adds a 5th voice: **harmony pad** — sine, plays a third above the bass at half gain. Only enabled when `mood === MOODS[5]`. Gives the boss room a fuller chord.

### Volume

The `setVolume` API stays. The music UI binds to it.

## Music UI

Lives in the side panel. Two controls:

- **Play/pause toggle** — small button. State persists to `localStorage.music_playing` (default `true`). On page load, if `false`, music starts paused; user clicks to start.
- **Volume slider** — range input 0–100%. Persists to `localStorage.music_volume` (default 50%). Synced with the existing dev-menu volume so they're not two separate values.

**Mute on tab blur** — `document.visibilitychange` → if hidden, `music.setVolume(0)`; on visible, restore. Default on, no UI control (this is just polite behavior).

On mobile, music controls only appear in the `expanded` drawer state — no room in the collapsed strip.

## Minimap zoom

Two modes:

- **Focused** — 8-tile radius window centered on hero. Canvas size = `17 × 17 × scale`. Useful on big floors so the hero pixel is easy to see.
- **Full** — entire floor as today.

Toggle: tap/click the minimap. Default mode chosen on floor enter:
- Floor wider than 40 tiles → `focused`
- Otherwise → `full`

Mode is per-floor-instance (resets on Descend, so a small floor stays full and the next big one auto-focuses).

In `focused` mode, the minimap still shows:
- Tiles in the 8-tile window (visibility rules unchanged — fog still applies).
- Items + actors in the window with the same color rules.
- A subtle border glow so the player knows they're zoomed.

Implementation: `minimap.update` takes a new `mode` param. Render function clips draws to the window and offsets coords by `(hero.x - 8, hero.y - 8)`.

## MIDI export

Dev menu gets a new button: **"Export MIDI"** (only visible when `?dev=1`).

### Capture

`createMusic` keeps a ring buffer of `NoteEvent { time: number; pitch: number; durMs: number; gain: number; voice: 'melody' | 'bass' | 'arp' | 'perc-kick' | 'perc-hat' }`. Cap at 4096 events (~5 minutes at the current density); drop oldest on overflow. Cleared on `setMoodForDepth` (so each floor is a fresh capture).

Each `playNote` and percussion call appends to this buffer.

### Encoding

When the user clicks Export, we synthesize a MIDI Type-1 file in-memory:

- Header: `MThd` chunk, format=1, ntrks=4, division=480 ticks/quarter.
- 4 `MTrk` chunks: melody / bass / arp / perc.
- Melody/bass/arp use channels 1/2/3, instrument program-change to `Synth Pad` (88) for variety. Percussion uses channel 10 (GM drum kit) with note pitches mapped — kick = 36, hi-hat = 42.
- Note-on / note-off events with delta-times computed from the captured `time` field. Velocity = `Math.round(gain * 127)`.
- End-of-track meta event per track.

Frequencies → MIDI pitches via `pitch = round(69 + 12 * log2(freq / 440))`.

The encoder lives in `src/audio/midiExport.ts` (~80 lines, no external dep). A test feeds a known event sequence and asserts the byte output matches a hand-checked golden file.

### Download

`new Blob([bytes], { type: 'audio/midi' })` → object URL → temp `<a download>` click → revoke URL. Filename: `skull-empires-<seed>-d<depth>.mid`.

## State, types, persistence

No World shape changes. Everything is presentation/control:

- `Music` capture buffer is in-memory only (not persisted).
- `localStorage` keys: `music_playing`, `music_volume`, `minimap_zoom_default` (last-used mode for fresh floors).
- No DB schema bump.

## File layout

New files:
- `src/ui/sidePanel.ts` — top-level panel mount that hosts the existing widgets in a vertical layout. Other widget modules (`hud.ts`, `minimap.ts`, `inventory.ts`) stay focused; they get `mount(parent)` calls into the panel column instead of the full HUD overlay.
- `src/ui/musicControls.ts` — play/pause + volume widget.
- `src/audio/midiExport.ts` — MIDI Type-1 encoder + download trigger.
- `src/dev/responsive.ts` — `matchMedia` wrapper exposing `isMobile` observable.

Modified:
- `index.html` — grid layout, `#side-panel` div, drop the floating `#hud` overlay (kept as a modal-only z-stack for dialog/reward).
- `src/main.ts` — wire side panel, resize observer, mobile drawer, music UI.
- `src/ui/hud.ts` — remove top-bar absolute positioning, render as a stat block in panel.
- `src/ui/inventory.ts` — restack to 2×3, drop bottom-floating positioning, accept panel parent.
- `src/ui/minimap.ts` — zoom mode param, click handler, panel parent.
- `src/audio/music.ts` — add bass/arp/perc voices, combat intensity, mood ducking, capture buffer, boss harmony.
- `src/ui/devMenu.ts` — add MIDI export button (gated on dev flag).

## Testing

- **Unit:** music capture buffer ring behavior; MIDI encoder against a hand-built golden; minimap window math.
- **Integration:** existing replay tests continue to pass (no World changes).
- **Manual smoke checklist (added to `docs/SMOKE.md`):**
  - desktop: panel renders right of canvas; canvas resizes correctly.
  - mobile (resize browser ≤768px): drawer collapses, expand/collapse via tap on header strip.
  - music: bass + perc audible; tempo bumps when enemy gets within 3 tiles; smooths back when they die or you flee.
  - minimap: tap toggles focused/full; large floor opens focused, small floor opens full.
  - MIDI: export downloads a `.mid` file; opens in a DAW and plays back recognizably.

## Risks and mitigations

- **Canvas resize blurs sprites** — pin canvas internal resolution to integer pixels (Math.floor on resize) and keep `image-rendering: pixelated`.
- **AudioContext over-spawn** — current `playNote` creates an osc per note. With 4 voices that's still ~10 oscs/sec which Chrome handles fine. If profiling shows trouble, pool oscillators per voice.
- **MIDI tick drift** — capture timestamps are `performance.now()` ms; converting to MIDI ticks needs a fixed BPM assumption. We pin export to the current mood's bpm. Edge case: an export spanning a mood change will sound slightly off; document this and accept it (single-floor exports are the common case anyway).
- **Touch + click both fire** — translate `touchstart` to `click` and `preventDefault` to avoid double-fire.

## Out of scope (explicitly deferred to post-1F)

- Pinch-zoom on canvas.
- Music presets / user-selectable moods.
- Replay-driven MIDI capture (export current floor only, not whole replay).
- HUD theming / multiple skins.
- Drag-and-drop inventory rearrangement.
