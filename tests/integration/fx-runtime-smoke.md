# Phase 1B runtime smoke test

Prerequisites:
1. `bun x vite` running; dev server on http://localhost:5173
2. Chrome DevTools MCP enabled

## Steps (tool calls)

1. **Open the game**
   - `chrome-devtools__new_page` → http://localhost:5173/?dev=1&seed=smoke-1
   - Wait for `#world` canvas to render (poll every 100ms up to 3s via `chrome-devtools__evaluate_script`: `document.getElementById('world')?.getContext('2d') != null`)
   - Screenshot (`chrome-devtools__take_screenshot`) — save as `smoke-1-initial.png`

2. **Verify font loaded**
   - `chrome-devtools__evaluate_script`: `document.fonts.check('16px UnifrakturMaguntia')` → expected `true` within 2s of page load

3. **Verify FX canvas present**
   - `chrome-devtools__evaluate_script`: `document.getElementById('fx')?.getContext('2d') != null` → `true`

4. **Hero slides on click**
   - Evaluate hero state pos, pick adjacent floor tile pos
   - `chrome-devtools__click` on that tile
   - Immediately `chrome-devtools__take_screenshot` → `smoke-1-move-start.png`
   - Wait 80ms, `smoke-1-move-mid.png`
   - Wait 100ms, `smoke-1-move-end.png`
   - Compare pixels in hero region: mid frame should differ from both start and end

5. **Hit flash + damage number on attack**
   - Wait for an enemy to approach adjacent to hero (observe state over ~2s)
   - Once adjacent, click the enemy tile
   - `chrome-devtools__take_screenshot` 60ms later → `smoke-1-hit.png`
   - Screenshot should show: (a) enemy with white overlay, (b) a red damage number above it

6. **Death spew on kill**
   - Continue attacking until an enemy dies
   - Screenshot 100ms after final attack → `smoke-1-death.png`
   - Screenshot should show ~12 white/amber particles radiating from former enemy position

7. **Screen shake on hero damage**
   - Let an adjacent enemy attack the hero
   - Screenshot 50ms into the shake → `smoke-1-shake.png`
   - Compare HUD element bounding box with a no-shake baseline — expect a 1-3px offset

8. **FPS holds**
   - `chrome-devtools__performance_start_trace`
   - Click 5 move actions, let enemies react (30 seconds of play)
   - `chrome-devtools__performance_stop_trace`
   - Average FPS ≥ 55 in the trace

9. **Silent if audio clips missing**
   - Watch `chrome-devtools__list_console_messages` — expect `[sfx] unknown or empty clip: ...` warnings if files absent, **no** uncaught errors

## Pass criteria

- All 9 steps observable as described
- No uncaught exceptions in console
- FPS ≥ 55 sustained under load
- Visual feel: smooth motion, clear hit feedback, particles visible on death, HUD font is the serif
