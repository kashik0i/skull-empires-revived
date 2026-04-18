# Phase 1F Smoke Checklist

Run `bun run dev` and walk through:

## Layout
- [ ] Side panel is visible to the right of the canvas; canvas does not overlap it.
- [ ] Canvas resizes when the browser is resized (no blurring of sprites).
- [ ] Click on a canvas tile near the right edge — hero responds; clicks are not eaten by the panel.
- [ ] Dialog (talk to merchant) and item-reward modal still center over the canvas, not the panel.

## Mobile
- [ ] Resize browser to <768px wide. Panel moves to bottom; header strip appears.
- [ ] Tap header → panel collapses to a thin strip with HP bar visible.
- [ ] Tap header again → panel expands.
- [ ] Tap on a tile via touch device or browser touch emulation — hero responds.

## Music
- [ ] On first floor: hear melody (triangle), bass (saw), arp (square), and steady kick + hi-hat percussion.
- [ ] Walk near an enemy (≤3 tiles): tempo bumps and percussion gets louder.
- [ ] Walk away: smoothly returns to baseline.
- [ ] Descend to depth 5 (boss): hear an additional sine pad layer.

## Music UI
- [ ] Side panel shows play/pause toggle + volume slider.
- [ ] Toggle pauses → music goes silent. Toggle plays → music resumes.
- [ ] Slider changes audible volume.
- [ ] Reload page: previous play/pause and volume state are restored.
- [ ] Switch to another tab: music goes silent. Switch back: returns.

## Minimap zoom
- [ ] Small floor: minimap defaults to "full" zoom (whole floor visible).
- [ ] Large floor (>40 tiles wide): minimap defaults to "focused" (window around hero).
- [ ] Click the minimap (or its toggle button): zoom mode flips.
- [ ] In focused mode, hero stays roughly centered as you walk.

## MIDI export
- [ ] With `?dev=1`, open the dev menu.
- [ ] After ~5s of music, click "Export MIDI".
- [ ] A `.mid` file downloads with name `skull-empires-<seed>-d<depth>.mid`.
- [ ] Open the file in a DAW; melody/bass/arp/perc are on separate tracks; tempo matches the floor's BPM.
