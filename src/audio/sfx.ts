export type SfxClipId = 'step' | 'hit' | 'death' | 'attack' | 'click'

export type SfxClipSpec = {
  id: SfxClipId
  src: string
  poolSize: number
}

export type Sfx = {
  play(id: SfxClipId): void
}

type AudioCtxLike = {
  currentTime: number
  state: string
  destination: AudioNode
  createOscillator(): OscillatorNode
  createGain(): GainNode
  resume(): Promise<void>
}

function getAudioContextCtor(): (new () => AudioCtxLike) | null {
  const g = globalThis as Record<string, unknown>
  const AC = (g.AudioContext ?? g.webkitAudioContext) as (new () => AudioCtxLike) | undefined
  return AC ?? null
}

export function createSfx(_specs: readonly SfxClipSpec[], opts: { volume: number }): Sfx {
  const AC = getAudioContextCtor()
  let ctx: AudioCtxLike | null = null

  function getCtx(): AudioCtxLike | null {
    if (!AC) return null
    if (!ctx) {
      try {
        ctx = new AC()
      } catch {
        return null
      }
    }
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
    }
    return ctx
  }

  function voicing(id: SfxClipId, c: AudioCtxLike): void {
    const now = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    const v = opts.volume

    switch (id) {
      case 'step': {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(520, now)
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(v * 0.25, now + 0.005)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
        osc.start(now)
        osc.stop(now + 0.08)
        return
      }
      case 'hit': {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.12)
        gain.gain.setValueAtTime(v * 0.5, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
        osc.start(now)
        osc.stop(now + 0.17)
        return
      }
      case 'death': {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(420, now)
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5)
        gain.gain.setValueAtTime(v * 0.4, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
        osc.start(now)
        osc.stop(now + 0.6)
        return
      }
      case 'attack': {
        osc.type = 'square'
        osc.frequency.setValueAtTime(320, now)
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.08)
        gain.gain.setValueAtTime(v * 0.28, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
        osc.start(now)
        osc.stop(now + 0.12)
        return
      }
      case 'click': {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(v * 0.25, now + 0.005)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
        osc.start(now)
        osc.stop(now + 0.07)
        return
      }
    }
  }

  return {
    play(id) {
      const c = getCtx()
      if (!c) return
      try {
        voicing(id, c)
      } catch {
        // any error during scheduling — drop silently
      }
    },
  }
}
