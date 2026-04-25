import { describe, it, expect, beforeEach } from 'bun:test'
import { createZoom, ZOOM_STEPS, ZOOM_DEFAULT_INDEX } from '../../src/ui/zoom'

function mockLocalStorage(initial?: string): Storage {
  let value = initial ?? null
  const store: Storage = {
    get length() { return value === null ? 0 : 1 },
    clear() { value = null },
    getItem: (k: string) => k === 'zoom_index' ? value : null,
    key: () => null,
    removeItem: (k: string) => { if (k === 'zoom_index') value = null },
    setItem: (k: string, v: string) => { if (k === 'zoom_index') value = v },
  }
  return store
}

beforeEach(() => {
  ;(globalThis as any).localStorage = mockLocalStorage()
})

describe('zoom', () => {
  it('starts at the default tile size', () => {
    const z = createZoom()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_DEFAULT_INDEX])
  })

  it('zoomIn and zoomOut step through the list and clamp at the ends', () => {
    const z = createZoom()
    for (let i = 0; i < 10; i++) z.zoomIn()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1])
    for (let i = 0; i < 10; i++) z.zoomOut()
    expect(z.tileSize()).toBe(ZOOM_STEPS[0])
  })

  it('reset returns to the default', () => {
    const z = createZoom()
    z.zoomIn()
    z.reset()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_DEFAULT_INDEX])
  })

  it('subscribers fire on change and not on no-op', () => {
    const z = createZoom()
    let calls = 0
    z.subscribe(() => calls++)
    z.zoomIn()
    expect(calls).toBe(1)
    // Move to max, then zoomIn again should be a no-op.
    while (z.tileSize() !== ZOOM_STEPS[ZOOM_STEPS.length - 1]) z.zoomIn()
    const before = calls
    z.zoomIn()
    expect(calls).toBe(before)
  })

  it('reads localStorage on construct', () => {
    ;(globalThis as any).localStorage = mockLocalStorage('3') // index 3 → 36px
    const z = createZoom()
    expect(z.tileSize()).toBe(ZOOM_STEPS[3])
  })

  it('writes localStorage on change', () => {
    const ls = mockLocalStorage()
    ;(globalThis as any).localStorage = ls
    const z = createZoom()
    z.zoomIn()
    expect(ls.getItem('zoom_index')).toBe(String(ZOOM_DEFAULT_INDEX + 1))
  })

  it('ignores out-of-range persisted values and falls back to default', () => {
    ;(globalThis as any).localStorage = mockLocalStorage('99')
    const z = createZoom()
    expect(z.tileSize()).toBe(ZOOM_STEPS[ZOOM_DEFAULT_INDEX])
  })
})
