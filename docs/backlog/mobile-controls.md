# Mobile-friendly controls

**Goal:** Make the game playable on a phone with touch.

**Approach:**
- Detect touch device via `'ontouchstart' in window` or pointer-coarse media query
- On touch devices, expose a virtual control layer:
  - Tap = same as click (set intent)
  - Long-press on tile = set move-target (visible cursor)
  - Drag from hero = directional swipe to step
- Hide the dev menu hotkey hint on touch devices
- Layout: HUD/cards/minimap need to scale + reposition for portrait phone screens
- Bigger touch targets for cards / dialog buttons

**Earmarked for:** Phase 1F (UI/UX polish + music).

**Surfaced:** Phase 1D session, user request ~2026-04-18.
