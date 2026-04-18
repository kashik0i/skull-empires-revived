# Tick consistency when no enemies alive

**Symptom:** Game perceptibly speeds up after the player kills all enemies on a floor — turn cadence collapses to near-zero delay.

**Cause (suspected):** `runCurrentActor` in `src/loop.ts` only sleeps `enemyTickMs` between ticks. When no enemies need to act, `decide()` returns `TurnAdvance` cheaply, and the loop blasts through `TurnAdvance` actions at frame rate.

**Approach to investigate:**
- Should `enemyTickMs` apply to *all* turn cadence, or only enemy turns?
- Probably want a fixed wall-clock `tickMs` regardless of who's acting (hero, enemy, idle).
- Worth a quick design discussion — fixed cadence vs. "skip empty turns" feels different in play.

**Surfaced:** Phase 1D session, user feedback ~2026-04-18.
