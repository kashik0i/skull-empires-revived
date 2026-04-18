# Phase 1D code-review polish items

From the final Phase 1D code review (commit range `b4f056f..cb642e6`).
None block ship; all are quality polish.

1. **Scroll pickup overwrites pendingDialog asymmetrically.** `move.ts` scroll
   block doesn't `!stateSoFar.pendingDialog` guard like the shrine block does.
   No current trigger; latent if multiple interactables ever co-locate.
2. **`openMerchantDialog` re-implements Fisher-Yates** instead of using the
   existing `shuffleWithRng` helper from `state.ts`. Pure DRY.
3. **Minimap colour overload.** Merchants share enemy red; shrines share
   stairs/items amber. Future floors with many of these will be confusing.
4. **`merchantTrade` doesn't validate `cardId`** via `getCard()`. Tampered URL
   replay could push an unknown id into the deck.
5. **HUD shows base ATK/DEF**, not effective ATK/DEF after status buffs.
   Makes Fortify/Vigor cards feel inert from the HUD's perspective.
6. **Merchant spawn position hardcoded to `(hero.x + 2, hero.y)`.** Narrow
   corridors silently lose the merchant. Consider BFS to nearest valid tile.
7. **`maybeOfferReward` uses `Math.random`** (pre-existing) — not deterministic
   from world seed; reward picks don't replay. Pre-dates Phase 1D but contrasts
   with the new merchant shuffle which uses world rng correctly.

**Surfaced:** Phase 1D final code review ~2026-04-18.
