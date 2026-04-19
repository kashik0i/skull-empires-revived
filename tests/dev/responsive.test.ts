import { describe, it, expect, beforeEach } from 'bun:test'
import { createResponsive } from '../../src/dev/responsive'

type Listener = (e: { matches: boolean }) => void

function mockMatchMedia(initialMatches: boolean): { setMatches(v: boolean): void } {
  let listeners: Listener[] = []
  let matches = initialMatches
  ;(globalThis as any).matchMedia = (_q: string) => ({
    get matches() { return matches },
    addEventListener: (_t: string, l: Listener) => { listeners.push(l) },
    removeEventListener: (_t: string, l: Listener) => { listeners = listeners.filter(x => x !== l) },
  })
  return {
    setMatches(v: boolean) { matches = v; for (const l of listeners) l({ matches: v }) },
  }
}

describe('createResponsive', () => {
  beforeEach(() => { mockMatchMedia(false) })

  it('reports current isMobile value', () => {
    mockMatchMedia(true)
    const r = createResponsive()
    expect(r.isMobile()).toBe(true)
  })

  it('notifies subscribers on change', () => {
    const ctl = mockMatchMedia(false)
    const r = createResponsive()
    const seen: boolean[] = []
    r.subscribe(v => seen.push(v))
    ctl.setMatches(true)
    ctl.setMatches(false)
    expect(seen).toEqual([true, false])
  })

  it('returns an unsubscribe handle', () => {
    const ctl = mockMatchMedia(false)
    const r = createResponsive()
    const seen: boolean[] = []
    const off = r.subscribe(v => seen.push(v))
    off()
    ctl.setMatches(true)
    expect(seen).toEqual([])
  })
})
