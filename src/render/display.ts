import type { ActorId, Pos, World } from '../core/types'

export type DisplayActor = {
  id: ActorId
  x: number; y: number
  sx: number; sy: number
  tx: number; ty: number
  tweenT: number
  tweenDurationMs: number
  lunge: null | {
    origin: Pos
    target: Pos
    phase: 'out' | 'recoil'
    elapsedMs: number
  }
}

const MOVE_DURATION_MS = 150
const LUNGE_HALF_MS = 80
const LUNGE_OVERSHOOT = 0.3

function easeOutCubic(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return 1 - (1 - c) ** 3
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export type DisplayState = {
  sync(world: World): void
  tick(dtMs: number): void
  get(id: ActorId): DisplayActor | undefined
  startLunge(id: ActorId, origin: Pos, target: Pos): void
  all(): readonly DisplayActor[]
}

export function createDisplayState(): DisplayState {
  const map = new Map<ActorId, DisplayActor>()

  return {
    sync(world) {
      for (const id in world.actors) {
        const actor = world.actors[id]
        const existing = map.get(id)
        if (!existing) {
          map.set(id, {
            id,
            x: actor.pos.x, y: actor.pos.y,
            sx: actor.pos.x, sy: actor.pos.y,
            tx: actor.pos.x, ty: actor.pos.y,
            tweenT: 1,
            tweenDurationMs: MOVE_DURATION_MS,
            lunge: null,
          })
        } else if (existing.tx !== actor.pos.x || existing.ty !== actor.pos.y) {
          existing.sx = existing.tx
          existing.sy = existing.ty
          existing.tx = actor.pos.x
          existing.ty = actor.pos.y
          existing.tweenT = 0
          existing.tweenDurationMs = MOVE_DURATION_MS
        }
      }
      for (const id of Array.from(map.keys())) {
        if (!(id in world.actors)) map.delete(id)
      }
    },
    tick(dtMs) {
      for (const d of map.values()) {
        if (d.lunge) {
          d.lunge.elapsedMs += dtMs
          const half = LUNGE_HALF_MS
          if (d.lunge.phase === 'out' && d.lunge.elapsedMs >= half) {
            d.lunge.phase = 'recoil'
            d.lunge.elapsedMs = 0
          }
          const peak = 0.5 + LUNGE_OVERSHOOT
          const t = Math.min(1, d.lunge.elapsedMs / half)
          const eased = easeOutCubic(t)
          const progress = d.lunge.phase === 'out' ? peak * eased : peak * (1 - eased)
          d.x = lerp(d.lunge.origin.x, d.lunge.target.x, progress)
          d.y = lerp(d.lunge.origin.y, d.lunge.target.y, progress)
          if (d.lunge.phase === 'recoil' && d.lunge.elapsedMs >= half) {
            d.x = d.lunge.origin.x
            d.y = d.lunge.origin.y
            d.lunge = null
          }
          continue
        }
        if (d.tweenT < 1) {
          d.tweenT = Math.min(1, d.tweenT + dtMs / d.tweenDurationMs)
          const eased = easeOutCubic(d.tweenT)
          d.x = lerp(d.sx, d.tx, eased)
          d.y = lerp(d.sy, d.ty, eased)
        }
      }
    },
    get(id) { return map.get(id) },
    startLunge(id, origin, target) {
      const d = map.get(id)
      if (!d) return
      d.lunge = { origin, target, phase: 'out', elapsedMs: 0 }
    },
    all() { return Array.from(map.values()) },
  }
}
