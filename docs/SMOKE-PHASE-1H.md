# Phase 1H smoke checklist

Date: 2026-04-25

## Walls
- [ ] Floors look like rooms with corners and edges, not flat brick rectangles.
- [ ] No black squares where wall variants are missing.

## Doors
- [ ] 1-2 closed doors visible on each non-boss floor.
- [ ] Bumping a closed door opens it; hero stays in place that turn; next click moves through.
- [ ] Closed doors block FOV — tiles past the door are dark until you open it.
- [ ] Open doors are passable and transparent for FOV.
- [ ] Refresh mid-floor with an opened door → door is still open after auto-resume.

## Chests
- [ ] One closed chest visible on most non-boss floors.
- [ ] Stepping onto the chest opens it and a flask/weapon/armor sprite appears on the tile.
- [ ] Walking off and back onto the open chest does NOT spawn a second drop.
- [ ] Pickup of the chest drop works the same as enemy drops.

## Decor
- [ ] Banners hang from north walls (not in the middle of rooms).
- [ ] Crates / skulls / columns appear in interior tiles, never on stairs / shrine / chest / door / scroll.
- [ ] Same seed produces the same decor on reload.

## Weapons
- [ ] Floor 1-2 drops feel "common-tier" (rusty/iron).
- [ ] Floor 4-5 drops include the new high-tier blades.

## Armor
- [ ] Cloth/leather/plate icons render in inventory + equipment slot.
- [ ] If `public/sprites/armor.png` is missing, equipment slot shows skull fallback (no crash).
- [ ] Equipping armor updates the HUD ATK/DEF readout.

## Build display
- [ ] Equipment slot shows a 32×32 weapon icon + name + +stat.
- [ ] Empty slot shows a faded outline placeholder.

## Persistence
- [ ] Refresh during a run with a closed door + open door + open chest. After auto-resume, all three render the same.

## Regressions (1G)
- [ ] Camera deadzone + smooth follow still feel right.
- [ ] Zoom keys + Ctrl-wheel + panel buttons still work.
- [ ] Dev menu button still toggles via panel + backtick.
- [ ] Replay from URL still loads.
