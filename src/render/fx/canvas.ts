import type { ParticlePool } from './particles'
import type { Tweens } from './tweens'

export type FloatNumber = {
  x: number; y: number
  vy: number
  text: string
  color: string
  fontPx: number
  ageMs: number
  lifeMs: number
}

export type Flash = {
  x: number; y: number
  radiusPx: number
  color: string
  ageMs: number
  lifeMs: number
}

export type ShakeState = { amplitudePx: number; freqHz: number; ageMs: number; lifeMs: number }

export type FxCanvas = {
  tick(dtMs: number): void
  draw(): void
  spawnFloat(f: FloatNumber): void
  spawnFlash(f: Flash): void
  spawnShake(s: ShakeState): void
  currentShakeOffset(): { x: number; y: number }
}

export function createFxCanvas(
  ctx: CanvasRenderingContext2D,
  particles: ParticlePool,
  tweens: Tweens,
): FxCanvas {
  const floats: FloatNumber[] = []
  const flashes: Flash[] = []
  let shake: ShakeState | null = null

  return {
    tick(dtMs) {
      particles.tick(dtMs)
      tweens.tick(dtMs)
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i]
        f.ageMs += dtMs
        f.y -= f.vy * (dtMs / 1000)
        if (f.ageMs >= f.lifeMs) floats.splice(i, 1)
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].ageMs += dtMs
        if (flashes[i].ageMs >= flashes[i].lifeMs) flashes.splice(i, 1)
      }
      if (shake) {
        shake.ageMs += dtMs
        if (shake.ageMs >= shake.lifeMs) shake = null
      }
    },
    draw() {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      for (const f of flashes) {
        const alpha = 1 - f.ageMs / f.lifeMs
        ctx.globalAlpha = Math.max(0, alpha)
        ctx.fillStyle = f.color
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.radiusPx, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      particles.forEachAlive(p => {
        const alpha = 1 - p.ageMs / p.lifeMs
        ctx.globalAlpha = Math.max(0, alpha)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - p.sizePx / 2, p.y - p.sizePx / 2, p.sizePx, p.sizePx)
      })
      ctx.globalAlpha = 1
      for (const f of floats) {
        const alpha = 1 - f.ageMs / f.lifeMs
        ctx.globalAlpha = Math.max(0, alpha)
        ctx.fillStyle = f.color
        ctx.font = `bold ${f.fontPx}px ui-serif, Georgia, serif`
        ctx.textAlign = 'center'
        ctx.fillText(f.text, f.x, f.y)
      }
      ctx.globalAlpha = 1
    },
    spawnFloat(f) { floats.push(f) },
    spawnFlash(f) { flashes.push(f) },
    spawnShake(s) { shake = s },
    currentShakeOffset() {
      if (!shake) return { x: 0, y: 0 }
      const t = shake.ageMs / 1000
      const decay = 1 - shake.ageMs / shake.lifeMs
      return {
        x: Math.sin(t * shake.freqHz * Math.PI * 2) * shake.amplitudePx * decay,
        y: Math.cos(t * shake.freqHz * Math.PI * 2) * shake.amplitudePx * decay,
      }
    },
  }
}
