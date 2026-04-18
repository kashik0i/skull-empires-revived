# Armor sprite placeholders

**Symptom:** All three armor items (`cloth-rags`, `leather-vest`, `plate-mail`) currently render with the `skull` sprite at `(288, 320)` because the 0x72 Dungeon Tileset II atlas does not include dedicated armor sprites.

**Where:** `src/render/sprites.ts` — the three armor entries all point to the same placeholder coordinates. `src/content/items.json` references `armor_cloth` / `armor_leather` / `armor_plate` which all resolve to the same FRAMES entry.

**Approach:**
- Source a small armor sprite addendum from a CC-BY pack
- Or commission three quick 16×16 armor pixel-art tiles
- Or differentiate visually by tinting the placeholder per tier (cheap fallback)

**Earmarked for:** Phase 1F (UI polish + visual refinement).

**Surfaced:** Phase 1E session, T6 implementation.
