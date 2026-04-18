export type MusicHandle = {
  start(): void
  stop(): void
  setVolume(v: number): void
  setMoodForDepth(depth: number): void
}

type Mood = { scale: readonly number[]; bpm: number; root: number }
const MOODS: Record<number, Mood> = {
  1: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220 },  // D minor
  2: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 60, root: 220 },
  3: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 70, root: 220 },
  4: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 80, root: 196 },  // G minor faster
  5: { scale: [0, 2, 3, 5, 7, 8, 11], bpm: 100, root: 220 }, // boss: harmonic minor
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

  let mood: Mood = MOODS[1]
  let stepIdx = 0
  let nextStepAt = 0
  let running = false
  let rngState = hash(seed)

  function rand(): number {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0
    return rngState / 0xffffffff
  }

  function playNote(freq: number, durMs: number, gain: number): void {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    env.gain.setValueAtTime(0, ctx.currentTime)
    env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.03)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
    osc.connect(env).connect(master)
    osc.start()
    osc.stop(ctx.currentTime + durMs / 1000 + 0.05)
  }

  function tick(now: number): void {
    if (!running) return
    if (now >= nextStepAt) {
      const stepMs = 60000 / mood.bpm / 2
      // 50% chance of a melody note this step.
      if (rand() < 0.5) {
        const semi = mood.scale[Math.floor(rand() * mood.scale.length)]
        const octave = rand() < 0.3 ? 1 : 0
        playNote(freqAt(mood.root, semi, octave), stepMs * 1.5, 0.08)
      }
      // Every 8 steps, drop a low pad note.
      if (stepIdx % 8 === 0) {
        playNote(freqAt(mood.root, mood.scale[0], -1), stepMs * 8, 0.04)
      }
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
  }
}
