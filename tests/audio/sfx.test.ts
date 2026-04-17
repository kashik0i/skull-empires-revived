import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createSfx, type SfxClipSpec } from '../../src/audio/sfx'

type FakeOsc = {
  type: string
  frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void; value: number }
  connect(n: unknown): void
  start(t: number): void
  stop(t: number): void
}
type FakeGain = {
  gain: { setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void }
  connect(n: unknown): void
}
type FakeCtx = {
  currentTime: number
  state: string
  destination: unknown
  createOscillator(): FakeOsc
  createGain(): FakeGain
  resume(): Promise<void>
}

let oldAC: unknown
let createdCtx = 0
let startedOscillators = 0

function installFakeAudioContext(): void {
  oldAC = (globalThis as Record<string, unknown>).AudioContext
  ;(globalThis as Record<string, unknown>).AudioContext = function (): FakeCtx {
    createdCtx++
    return {
      currentTime: 0,
      state: 'running',
      destination: {},
      createOscillator(): FakeOsc {
        return {
          type: 'sine',
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 },
          connect() {},
          start() { startedOscillators++ },
          stop() {},
        }
      },
      createGain(): FakeGain {
        return {
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
        }
      },
      async resume() {},
    }
  } as unknown
}

function uninstallFakeAudioContext(): void {
  ;(globalThis as Record<string, unknown>).AudioContext = oldAC
  createdCtx = 0
  startedOscillators = 0
}

beforeEach(installFakeAudioContext)
afterEach(uninstallFakeAudioContext)

const clips: SfxClipSpec[] = [
  { id: 'step', src: 'ignored', poolSize: 1 },
  { id: 'hit', src: 'ignored', poolSize: 1 },
  { id: 'death', src: 'ignored', poolSize: 1 },
  { id: 'attack', src: 'ignored', poolSize: 1 },
  { id: 'click', src: 'ignored', poolSize: 1 },
]

describe('synth sfx', () => {
  it('createSfx does not instantiate AudioContext eagerly', () => {
    createSfx(clips, { volume: 0.5 })
    expect(createdCtx).toBe(0)
  })

  it('first play creates one AudioContext and schedules an oscillator', () => {
    const sfx = createSfx(clips, { volume: 0.5 })
    sfx.play('hit')
    expect(createdCtx).toBe(1)
    expect(startedOscillators).toBe(1)
  })

  it('subsequent plays reuse the same AudioContext', () => {
    const sfx = createSfx(clips, { volume: 0.5 })
    sfx.play('hit')
    sfx.play('step')
    sfx.play('death')
    expect(createdCtx).toBe(1)
    expect(startedOscillators).toBe(3)
  })

  it('play() on any clip id does not throw', () => {
    const sfx = createSfx(clips, { volume: 0.5 })
    for (const id of ['step', 'hit', 'death', 'attack', 'click'] as const) {
      expect(() => sfx.play(id)).not.toThrow()
    }
  })

  it('silently no-ops when AudioContext is unavailable', () => {
    ;(globalThis as Record<string, unknown>).AudioContext = undefined
    const sfx = createSfx(clips, { volume: 0.5 })
    expect(() => sfx.play('hit')).not.toThrow()
    expect(startedOscillators).toBe(0)
  })
})
