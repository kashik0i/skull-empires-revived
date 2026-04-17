# SFX clips

Phase 1B uses 5 short CC0 SFX clips. The game is silent but fully playable without them.

Expected files (mp3 or ogg, ~5-30KB each):

| File | Trigger | Suggestion |
|---|---|---|
| step.mp3 | hero moves | soft footstep on stone |
| hit.mp3 | any actor damaged | dull impact |
| death.mp3 | actor dies | brittle shatter or exhale |
| attack.mp3 | any actor attacks | metal swish or bone rattle |
| click.mp3 | card played (1C) | clean ui click |

## Sources

- https://kenney.nl/assets/interface-sounds (CC0, tons of free UI clicks)
- https://kenney.nl/assets/sci-fi-sounds (CC0, some fit bone/skull)
- https://freesound.org (filter by CC0 — attribution not required but appreciated)

Drop the files next to this README. Browser caches them; no code change needed.

If a clip is missing, `src/audio/sfx.ts` warns once and skips — gameplay is not affected.
