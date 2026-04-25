# Phase 1G smoke checklist

Date: 2026-04-25

## Camera
- [ ] Move hero one tile in any direction near the floor center → camera does NOT pan (hero is inside deadzone).
- [ ] Move hero many tiles toward an edge → camera pans smoothly (visible easing, not jitter).
- [ ] Stand at a wall in the corner → camera clamps; hero is offset toward that corner on screen.
- [ ] Descend stairs → camera does NOT visibly drift across the transition.

## Zoom
- [ ] Press `+` → tiles get bigger; minimap window proportionally shrinks.
- [ ] Press `-` → tiles get smaller; more world visible.
- [ ] Press `0` → returns to 100%.
- [ ] Click the panel `−` / `+` buttons → same behavior as keys; readout updates.
- [ ] Hold Ctrl (or ⌘ on macOS) and scroll wheel on canvas → zoom steps. A single brisk trackpad swipe steps once or twice, NOT all the way to max.
- [ ] Plain wheel (no modifier) does nothing on canvas; page scroll behaves normally.
- [ ] Reload the page → zoom level persists.

## Click correctness
- [ ] At each zoom level, click a wall and a floor tile → highlight (or movement attempt) lands on the tile under the cursor, not next to it.
- [ ] Trigger a hit and watch shake → during the shake, clicking still hits the tile under the cursor (shake doesn't fold into click math).

## Shake
- [ ] Hero takes damage → noticeable kick (≈4px, 200ms).
- [ ] Kill an enemy → small kick (≈2px, 120ms).
- [ ] Die → strong kick (≈8px, 500ms).
- [ ] Win the run → no shake.

## Dev menu button
- [ ] Side panel shows a "Dev menu" button at the bottom.
- [ ] Click → menu opens. Click again → closes.
- [ ] Hotkey `` ` `` still works.
- [ ] On mobile (devtools touch emulation): drawer expands → button visible and tappable.

## Regressions
- [ ] Music play/pause + volume still work.
- [ ] Inventory + equip flow still works.
- [ ] Minimap focused/full toggle still works.
- [ ] Replay from URL still works.
