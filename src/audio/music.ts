import type { World } from '../core/types'

export type MusicHandle = {
  start(): void
  stop(): void
  setVolume(v: number): void
  setMoodForDepth(depth: number): void
  setWorldRef(get: () => World): void
}

type Mood = { scale: readonly number[]; bpm: number; root: number; bossHarmony: boolean }
const MOODS: Record<number, Mood> = {
  1: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220, bossHarmony: false },
  2: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220, bossHarmony: false },
  3: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 70, root: 220, bossHarmony: false },
  4: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 80, root: 196, bossHarmony: false },
  5: { scale: [0, 2, 3, 5, 7, 8, 11], bpm: 100, root: 220, bossHarmony: true },
}

function freqAt(root: number, semis: number, octave = 0): number {
  return root * Math.pow(2, semis / 12 + octave)
}

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function createMusic(seed: string): MusicHandle {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const melodyGain = ctx.createGain(); melodyGain.gain.value = 1.0; melodyGain.connect(master)
  const bassGain   = ctx.createGain(); bassGain.gain.value   = 0.4; bassGain.connect(master)
  const arpGain    = ctx.createGain(); arpGain.gain.value    = 0.3; arpGain.connect(master)
  const percGain   = ctx.createGain(); percGain.gain.value   = 0.3; percGain.connect(master)
  const harmonyGain = ctx.createGain(); harmonyGain.gain.value = 0.0; harmonyGain.connect(master)

  let mood: Mood = MOODS[1]
  let stepIdx = 0
  let nextStepAt = 0
  let running = false
  let rngState = hash(seed)
  let getWorld: (() => World) | null = null

  function combatLevel(): 'explore' | 'combat' {
    if (!getWorld) return 'explore'
    const w = getWorld()
    const hero = w.actors[w.heroId]
    if (!hero || !hero.alive) return 'explore'
    let nearest = Infinity
    for (const a of Object.values(w.actors)) {
      if (a.id === w.heroId || !a.alive || a.kind !== 'enemy') continue
      const d = Math.max(Math.abs(a.pos.x - hero.pos.x), Math.abs(a.pos.y - hero.pos.y))
      if (d < nearest) nearest = d
    }
    return nearest <= 3 ? 'combat' : 'explore'
  }

  function applyMix(level: 'explore' | 'combat'): void {
    const t = ctx.currentTime
    const TC = 0.5  // time constant — ~1s smoothing
    if (level === 'combat') {
      bassGain.gain.setTargetAtTime(0.6, t, TC)
      percGain.gain.setTargetAtTime(0.7, t, TC)
    } else {
      bassGain.gain.setTargetAtTime(0.4, t, TC)
      percGain.gain.setTargetAtTime(0.3, t, TC)
    }
  }

  function effectiveBpm(): number {
    return combatLevel() === 'combat' ? mood.bpm * 1.25 : mood.bpm
  }

  function rand(): number {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0
    return rngState / 0xffffffff
  }

  function playMelody(freq: number, durMs: number): void {
    const osc = ctx.createOscillator(), env = ctx.createGain()
    osc.type = 'triangle'; osc.frequency.value = freq
    env.gain.setValueAtTime(0, ctx.currentTime)
    env.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
    osc.connect(env).connect(melodyGain)
    osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
  }

  function playBass(freq: number, durMs: number): void {
    const osc = ctx.createOscillator(), env = ctx.createGain(), lp = ctx.createBiquadFilter()
    osc.type = 'sawtooth'; osc.frequency.value = freq
    lp.type = 'lowpass'; lp.frequency.value = 600
    env.gain.setValueAtTime(0, ctx.currentTime)
    env.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
    osc.connect(env).connect(lp).connect(bassGain)
    osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
  }

  function playArp(freq: number, durMs: number): void {
    const osc = ctx.createOscillator(), env = ctx.createGain()
    osc.type = 'square'; osc.frequency.value = freq
    env.gain.setValueAtTime(0, ctx.currentTime)
    env.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
    osc.connect(env).connect(arpGain)
    osc.start(); osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
  }

  function playPerc(kind: 'kick' | 'hat'): void {
    // Short noise burst through bandpass.
    const dur = kind === 'kick' ? 0.12 : 0.05
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.value = kind === 'kick' ? 80 : 7000
    bp.Q.value = kind === 'kick' ? 1 : 4
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.5, ctx.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    src.connect(bp).connect(env).connect(percGain)
    src.start()
  }

  function tick(now: number): void {
    if (!running) return
    if (now >= nextStepAt) {
      const level = combatLevel()
      applyMix(level)
      const beatMs = 60000 / effectiveBpm()
      const stepMs = beatMs / 2  // 8th-note grid

      // Melody — 60% chance per step, weighted toward lower scale degrees.
      if (rand() < 0.6) {
        const idx = Math.floor(rand() * rand() * mood.scale.length)
        const semi = mood.scale[idx]
        const octave = rand() < 0.2 ? 1 : 0
        playMelody(freqAt(mood.root, semi, octave), stepMs * 1.5)
      }

      // Bass on downbeat (every 8 steps).
      if (stepIdx % 8 === 0) {
        playBass(freqAt(mood.root, mood.scale[0], -1), beatMs * 4)
      }
      // Bass fifth on beat 3 (step 4 of the bar).
      if (stepIdx % 8 === 4) {
        playBass(freqAt(mood.root, mood.scale[4], -1), beatMs * 2)
      }

      // Arpeggio every other bar (16 steps), 4 ascending notes.
      const barStep = stepIdx % 16
      if (stepIdx % 32 < 16 && barStep % 2 === 0 && barStep < 8) {
        const arpIdx = barStep / 2
        const semi = mood.scale[arpIdx % mood.scale.length]
        playArp(freqAt(mood.root, semi, 1), stepMs)
      }

      // Percussion: kick on beats 1+3 (steps 0, 4), hat on offbeats (every odd step).
      if (stepIdx % 8 === 0 || stepIdx % 8 === 4) playPerc('kick')
      if (stepIdx % 2 === 1) playPerc('hat')

      stepIdx++
      nextStepAt = now + stepMs
    }
    requestAnimationFrame(tick)
  }

  return {
    start() {
      if (running) return
      running = true
      ctx.resume().catch(() => {})
      nextStepAt = performance.now()
      requestAnimationFrame(tick)
    },
    stop() { running = false },
    setVolume(v) {
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05)
    },
    setMoodForDepth(d) {
      mood = MOODS[d] ?? MOODS[5]
    },
    setWorldRef(get) { getWorld = get },
  }
}
