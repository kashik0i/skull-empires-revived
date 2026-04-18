# Memory audit — usage at ~153 MB

**Observed:** Browser tab sits at ~153 MB resident during normal play. Feels heavy for a 2D canvas roguelike.

**Likely culprits to profile:**
- Sprite atlas image (kept decoded in memory)
- OPFS sqlite WASM + worker
- Action log array growing unbounded across run
- Display state map never compacts dead actors
- Per-frame string allocations in HUD/log
- `seenTiles` Uint8Array per floor (small but persistent)

**Approach:**
- Take a heap snapshot at idle and after a full run, diff
- Look for retained closures over old World snapshots
- Consider capping `world.log` to last N entries (or moving to a ring buffer)
- Consider truncating `display` map when actor dies + animation finishes

**Surfaced:** Phase 1D session, user feedback ~2026-04-18.
