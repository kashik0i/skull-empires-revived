import { describe, it, expect } from 'bun:test'
import { createCameraController } from '../../src/render/cameraController'

const tileSize = 24
const vw = 480, vh = 360       // 20x15 viewport in tiles
const fw = 100, fh = 100       // 100x100 floor (pixels: 2400x2400)

function update(c: ReturnType<typeof createCameraController>, hx: number, hy: number, dt = 16) {
  return c.update({
    heroDisplay: { x: hx, y: hy },
    tileSize,
    viewportW: vw, viewportH: vh,
    floorW: fw, floorH: fh,
    dtMs: dt,
  })
}

describe('cameraController', () => {
  it('snap puts current at the clamped target on first update', () => {
    const c = createCameraController()
    c.snap()
    const out = update(c, 50 * tileSize, 50 * tileSize)
    // hero center at 1212, viewport center at 240 → target.x = 1212 - 240 = 972
    expect(out.x).toBe(50 * tileSize + tileSize / 2 - vw / 2)
    expect(out.y).toBe(50 * tileSize + tileSize / 2 - vh / 2)
  })

  it('clamps target axis to 0 when floor fits viewport on that axis', () => {
    const c = createCameraController()
    c.snap()
    const out = c.update({
      heroDisplay: { x: 5 * tileSize, y: 5 * tileSize },
      tileSize, viewportW: 960, viewportH: 720,
      floorW: 10, floorH: 10, dtMs: 16,
    })
    expect(out).toEqual({ x: 0, y: 0 })
  })

  it('keeps target unchanged while hero stays inside the deadzone', () => {
    const c = createCameraController({ deadzoneFractionX: 0.4, deadzoneFractionY: 0.4 })
    c.snap()
    const a = update(c, 50 * tileSize, 50 * tileSize)
    // Deadzone half-width = 480 * 0.4 / 2 = 96px (4 tiles). One tile move stays inside.
    const b = update(c, 51 * tileSize, 50 * tileSize)
    expect(b.x).toBe(a.x)
    expect(b.y).toBe(a.y)
  })

  it('shifts target by exactly the overshoot once hero crosses deadzone edge', () => {
    const c = createCameraController({ deadzoneFractionX: 0.4, deadzoneFractionY: 0.4, lerpHz: 1e6 })
    c.snap()
    update(c, 50 * tileSize, 50 * tileSize) // establish camera target around hero
    // Push hero far right so it overshoots the deadzone right edge.
    const out = update(c, 80 * tileSize, 50 * tileSize, 1000)
    // hero center pixel = 80*24 + 12 = 1932; viewport right edge of deadzone in screen coords = vw/2 + dhw = 240 + 96 = 336
    // target.x such that hero screen-x = 336 → target.x = 1932 - 336 = 1596 (pre-clamp)
    // floor width pixels = 2400; max x = 2400 - 480 = 1920 → 1596 < 1920 so no clamp
    expect(out.x).toBe(1596)
  })

  it('lerp converges monotonically toward a constant target', () => {
    const c = createCameraController({ lerpHz: 12 })
    c.snap()
    update(c, 50 * tileSize, 50 * tileSize) // establish base
    // jump hero suddenly so target shifts; without snap, current lerps
    const positions = [] as number[]
    for (let i = 0; i < 20; i++) positions.push(update(c, 80 * tileSize, 50 * tileSize, 16).x)
    // monotonic non-decreasing (target is to the right)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1])
    }
    // approaches the clamped target (hero too far → target = 1596)
    expect(positions[positions.length - 1]).toBeGreaterThan(1500)
  })

  it('snap() forces the next update to land exactly on the target', () => {
    const c = createCameraController({ lerpHz: 12 })
    c.snap()
    update(c, 50 * tileSize, 50 * tileSize)
    // Without snap, the next big jump would lerp.
    c.snap()
    const out = update(c, 80 * tileSize, 50 * tileSize, 16)
    expect(out.x).toBe(1596) // exactly target, no lerp
  })

  it('current() reflects the most recent update output', () => {
    const c = createCameraController()
    c.snap()
    const out = update(c, 50 * tileSize, 50 * tileSize)
    expect(c.current()).toEqual(out)
  })
})
