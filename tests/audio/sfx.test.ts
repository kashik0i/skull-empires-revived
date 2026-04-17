import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createSfx, type SfxClipSpec } from '../../src/audio/sfx'

type FakeAudio = {
  src: string
  volume: number
  currentTime: number
  preload: string
  play(): Promise<void>
  pause(): void
  load(): void
  addEventListener(ev: string, cb: () => void): void
}

let oldAudio: unknown
let created: FakeAudio[] = []

beforeEach(() => {
  oldAudio = (globalThis as Record<string, unknown>).Audio
  ;(globalThis as Record<string, unknown>).Audio = function (src: string): FakeAudio {
    const a: FakeAudio = {
      src, volume: 1, currentTime: 0, preload: '',
      play: async () => { a.currentTime = 0 },
      pause: () => {},
      load: () => {},
      addEventListener: () => {},
    }
    created.push(a)
    return a
  } as unknown
})

afterEach(() => {
  ;(globalThis as Record<string, unknown>).Audio = oldAudio
  created = []
})

describe('sfx pool', () => {
  it('preloads Audio instances per clip spec', () => {
    const spec: SfxClipSpec[] = [
      { id: 'hit', src: '/audio/hit.mp3', poolSize: 3 },
      { id: 'step', src: '/audio/step.mp3', poolSize: 1 },
    ]
    const sfx = createSfx(spec, { volume: 0.5 })
    expect(created.length).toBe(4)
    expect(created[0].src).toContain('hit.mp3')
    expect(sfx).toBeDefined()
  })

  it('play() triggers without throwing when clip exists', () => {
    const sfx = createSfx([{ id: 'hit', src: '/audio/hit.mp3', poolSize: 2 }], { volume: 0.5 })
    expect(() => sfx.play('hit')).not.toThrow()
  })

  it('play() on unknown clip warns but does not throw', () => {
    const sfx = createSfx([{ id: 'hit', src: '/audio/hit.mp3', poolSize: 2 }], { volume: 0.5 })
    expect(() => sfx.play('unknown' as unknown as 'hit')).not.toThrow()
  })
})
