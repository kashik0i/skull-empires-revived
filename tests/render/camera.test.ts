import { describe, it, expect } from 'bun:test'
import { computeCameraOffset, screenToWorldTile } from '../../src/render/camera'

describe('computeCameraOffset', () => {
  const tile = 24

  it('returns {0,0} when floor fits within viewport on both axes', () => {
    // floor 10x10 * 24 = 240x240; viewport 960x720 → floor fits → offset 0
    const offset = computeCameraOffset({ x: 5 * tile, y: 5 * tile }, tile, 960, 720, 10, 10)
    expect(offset).toEqual({ x: 0, y: 0 })
  })

  it('returns {0,0} on an axis where floor fits, even if hero far along it', () => {
    // floor 10 wide (240px) fits in 960 viewport; floor 100 tall (2400px) does not fit in 720
    const offset = computeCameraOffset({ x: 9 * tile, y: 50 * tile }, tile, 960, 720, 10, 100)
    expect(offset.x).toBe(0)
    expect(offset.y).toBeGreaterThan(0)
  })

  it('clamps offset to [0, floor*tile - viewport] when hero is at far corner', () => {
    // floor 100x100 * 24 = 2400x2400; viewport 960x720; max offset = 2400-960=1440, 2400-720=1680
    const offset = computeCameraOffset({ x: 99 * tile, y: 99 * tile }, tile, 960, 720, 100, 100)
    expect(offset.x).toBe(2400 - 960)
    expect(offset.y).toBe(2400 - 720)
  })

  it('clamps offset to 0 when hero is near origin (negative raw offset)', () => {
    // hero at origin on large floor → raw centered offset would be negative → clamp to 0
    const offset = computeCameraOffset({ x: 0, y: 0 }, tile, 960, 720, 100, 100)
    expect(offset).toEqual({ x: 0, y: 0 })
  })

  it('centers hero when hero is in the interior of a large floor', () => {
    // hero at pixel (1200,1200) on 100x100 floor; viewport 960x720
    // raw offset = 1200 + tile/2 - vp/2
    const heroDisplay = { x: 1200, y: 1200 }
    const offset = computeCameraOffset(heroDisplay, tile, 960, 720, 100, 100)
    // Expect hero center (heroDisplay.x + tile/2) minus offset = viewportW/2
    expect(heroDisplay.x + tile / 2 - offset.x).toBe(960 / 2)
    expect(heroDisplay.y + tile / 2 - offset.y).toBe(720 / 2)
  })

  it('hero at corner → offset clamped, hero is not centered in viewport', () => {
    // sanity: on large floor, hero at bottom-right, offset clamps; hero center is not at viewport center
    const offset = computeCameraOffset({ x: 99 * tile, y: 99 * tile }, tile, 960, 720, 100, 100)
    const heroCenterOnScreenX = 99 * tile + tile / 2 - offset.x
    const heroCenterOnScreenY = 99 * tile + tile / 2 - offset.y
    expect(heroCenterOnScreenX).not.toBe(960 / 2)
    expect(heroCenterOnScreenY).not.toBe(720 / 2)
    // hero should be near the bottom-right of the viewport, not past its edges
    expect(heroCenterOnScreenX).toBeGreaterThan(960 / 2)
    expect(heroCenterOnScreenY).toBeGreaterThan(720 / 2)
    expect(heroCenterOnScreenX).toBeLessThanOrEqual(960)
    expect(heroCenterOnScreenY).toBeLessThanOrEqual(720)
  })
})

describe('screenToWorldTile', () => {
  const tile = 24

  it('inverts a nonzero camera offset at 1:1 CSS scale', () => {
    // canvas 960x720, rect 960x720 (1:1), click at (100,200), offset (48,72)
    const canvasRect = { left: 0, top: 0, width: 960, height: 720 }
    const canvasSize = { width: 960, height: 720 }
    const result = screenToWorldTile(100, 200, canvasRect, canvasSize, tile, { x: 48, y: 72 })
    expect(result).toEqual({
      x: Math.floor((100 + 48) / 24),
      y: Math.floor((200 + 72) / 24),
    })
  })

  it('accounts for canvas rect offset (left/top)', () => {
    const canvasRect = { left: 50, top: 30, width: 960, height: 720 }
    const canvasSize = { width: 960, height: 720 }
    // click at client (150, 230) → canvas coords (100, 200)
    const result = screenToWorldTile(150, 230, canvasRect, canvasSize, tile, { x: 0, y: 0 })
    expect(result).toEqual({
      x: Math.floor(100 / 24),
      y: Math.floor(200 / 24),
    })
  })

  it('handles CSS scale when canvas rect differs from canvas size', () => {
    // canvas backing size 960x720, displayed at 480x360 (half size in CSS)
    const canvasRect = { left: 0, top: 0, width: 480, height: 360 }
    const canvasSize = { width: 960, height: 720 }
    // click at screen (50, 100) → canvas pixel (100, 200)
    const result = screenToWorldTile(50, 100, canvasRect, canvasSize, tile, { x: 48, y: 72 })
    expect(result).toEqual({
      x: Math.floor((100 + 48) / 24),
      y: Math.floor((200 + 72) / 24),
    })
  })

  it('zero offset, 1:1 scale, click at origin → tile (0,0)', () => {
    const canvasRect = { left: 0, top: 0, width: 960, height: 720 }
    const canvasSize = { width: 960, height: 720 }
    const result = screenToWorldTile(0, 0, canvasRect, canvasSize, tile, { x: 0, y: 0 })
    expect(result).toEqual({ x: 0, y: 0 })
  })
})
