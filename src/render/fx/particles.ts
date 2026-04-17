export type Particle = {
  alive: boolean
  x: number; y: number
  vx: number; vy: number
  sizePx: number
  color: string
  ageMs: number
  lifeMs: number
  gravity: number
}

export type EmitterSpec = {
  count: number
  origin: { x: number; y: number }
  speed: [number, number]
  angleRange: [number, number]
  lifeMs: number
  sizePx: [number, number]
  color: string
  gravity: number
}

export type ParticlePool = {
  emit(spec: EmitterSpec): void
  tick(dtMs: number): void
  aliveCount(): number
  snapshot(): readonly Particle[]
  forEachAlive(cb: (p: Particle) => void): void
}

export function createParticles(opts: { capacity: number }): ParticlePool {
  const slots: Particle[] = Array.from({ length: opts.capacity }, () => ({
    alive: false,
    x: 0, y: 0, vx: 0, vy: 0,
    sizePx: 1, color: '#fff',
    ageMs: 0, lifeMs: 0, gravity: 0,
  }))
  let nextIdx = 0

  function acquire(): Particle {
    for (let i = 0; i < slots.length; i++) {
      const idx = (nextIdx + i) % slots.length
      if (!slots[idx].alive) { nextIdx = (idx + 1) % slots.length; return slots[idx] }
    }
    const p = slots[nextIdx]
    nextIdx = (nextIdx + 1) % slots.length
    return p
  }

  return {
    emit(spec) {
      for (let i = 0; i < spec.count; i++) {
        const p = acquire()
        const angle = spec.angleRange[0] + Math.random() * (spec.angleRange[1] - spec.angleRange[0])
        const speed = spec.speed[0] + Math.random() * (spec.speed[1] - spec.speed[0])
        p.alive = true
        p.x = spec.origin.x
        p.y = spec.origin.y
        p.vx = Math.cos(angle) * speed
        p.vy = Math.sin(angle) * speed
        p.sizePx = spec.sizePx[0] + Math.random() * (spec.sizePx[1] - spec.sizePx[0])
        p.color = spec.color
        p.ageMs = 0
        p.lifeMs = spec.lifeMs
        p.gravity = spec.gravity
      }
    },
    tick(dtMs) {
      const dtSec = dtMs / 1000
      for (const p of slots) {
        if (!p.alive) continue
        p.ageMs += dtMs
        if (p.ageMs >= p.lifeMs) { p.alive = false; continue }
        p.x += p.vx * dtSec
        p.y += p.vy * dtSec
        p.vy += p.gravity * dtSec
      }
    },
    aliveCount() { return slots.filter(p => p.alive).length },
    snapshot() { return slots.filter(p => p.alive).map(p => ({ ...p })) },
    forEachAlive(cb) { for (const p of slots) if (p.alive) cb(p) },
  }
}
