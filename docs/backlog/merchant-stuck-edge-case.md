# Merchant interaction edge case

**Symptom (Phase 1D, before "intent wins" + "dialog pauses ticks" fixes):**
Player adjacent to merchant + adjacent to enemy. Click merchant did nothing
visible; only escape was toggling "Pause enemies" in the dev menu.

**Fixes shipped during Phase 1D:**
- `feat/phase-1d` `f71ea7d` — player intent now wins over auto-defend
- `feat/phase-1d` `8671912` — game ticks freeze while a dialog is open
- `feat/phase-1d` `8671912` — bought cards land in hand, not deck

**Verify:** If user reports the same stuck pattern after these commits ship,
the problem is something else — likely:
- `tileIsKnown` gate dropping clicks silently
- `firstStepToward` returning null because the path is blocked by an enemy
  (which then clears intent → next tick with no intent → auto-defend re-engages)

**Possible follow-up:**
- Show a small visual indicator when a click is dropped (fog or unreachable)
- When `firstStepToward` returns null, retry once with enemies-as-passable for one step (suicide step) — actually probably not, that's bad design
- Consider a "force-flee" action that prioritises retreat over auto-defend even with no intent

**Surfaced:** Phase 1D session, user feedback ~2026-04-18.
