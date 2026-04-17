import { palette } from '../../content/palette'
import type { FxBus, FxEvent } from './bus'
import type { ParticlePool } from './particles'
import type { FxCanvas } from './canvas'
import type { DisplayState } from '../display'

const TILE_SIZE = 24

function posPx(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 }
}

export function wirePresets(
  bus: FxBus,
  canvas: FxCanvas,
  particles: ParticlePool,
  display: DisplayState,
): () => void {
  return bus.subscribe((event: FxEvent) => {
    switch (event.kind) {
      case 'moved':
        // display state handles motion; no FX emission
        return
      case 'attacked': {
        display.startLunge(event.attackerId, event.attackerPos, event.targetPos)
        return
      }
      case 'damaged': {
        const p = posPx(event.pos.x, event.pos.y)
        canvas.spawnFlash({
          x: p.x, y: p.y,
          radiusPx: TILE_SIZE * 0.45,
          color: palette.boneWhite,
          ageMs: 0, lifeMs: 120,
        })
        canvas.spawnFloat({
          x: p.x, y: p.y - TILE_SIZE * 0.3,
          vy: 30,
          text: `-${event.amount}`,
          color: palette.bloodCrimson,
          fontPx: 14,
          ageMs: 0, lifeMs: 600,
        })
        if (event.isHero) {
          canvas.spawnShake({ amplitudePx: 3, freqHz: 40, ageMs: 0, lifeMs: 100 })
        }
        return
      }
      case 'died': {
        const p = posPx(event.pos.x, event.pos.y)
        particles.emit({
          count: 12,
          origin: p,
          speed: [30, 90],
          angleRange: [0, Math.PI * 2],
          lifeMs: 700,
          sizePx: [2, 4],
          color: palette.boneWhite,
          gravity: 80,
        })
        return
      }
      case 'card-played': {
        const target = event.targetPos ? posPx(event.targetPos.x, event.targetPos.y) : null
        canvas.spawnFlash({
          x: (target ?? { x: 480 }).x,
          y: (target ?? { y: 320 }).y,
          radiusPx: TILE_SIZE * 2,
          color: palette.silkFlameAmber,
          ageMs: 0, lifeMs: 200,
        })
        if (target) {
          particles.emit({
            count: 20,
            origin: target,
            speed: [40, 120],
            angleRange: [0, Math.PI * 2],
            lifeMs: 500,
            sizePx: [2, 3],
            color: palette.silkFlameAmber,
            gravity: 0,
          })
        }
        return
      }
      case 'run-ended':
        return
    }
  })
}
