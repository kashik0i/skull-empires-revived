import type { Action, ActorId, World } from '../core/types'
import { firstStepToward, manhattan } from './pathfind'

/**
 * Resolve the hero's action for the current turn based on world state + hero intent.
 * Rules:
 *   1. Auto-defend: if any alive enemy is adjacent, attack the one with lowest HP.
 *   2. Attack intent: if target alive, pathfind toward it. If target dead or unreachable, clear intent.
 *   3. Move-to intent: pathfind toward the goal tile. Clear intent once reached or unreachable.
 *   4. No intent, no threat: return null (hero idles).
 */
export function resolveHeroAction(state: World): Action | null {
  const hero = state.actors[state.heroId]
  if (!hero || !hero.alive) return null

  // 1. Auto-defend: attack any adjacent enemy.
  const adjacent = findAdjacentEnemy(state, hero.pos)
  if (adjacent) {
    return { type: 'AttackActor', attackerId: hero.id, targetId: adjacent }
  }

  const intent = state.heroIntent
  if (!intent) return null

  if (intent.kind === 'attack') {
    const target = state.actors[intent.targetId]
    if (!target || !target.alive) {
      return { type: 'SetHeroIntent', intent: null }
    }
    const step = firstStepToward(state, hero.pos, target.pos, { passThroughActors: [target.id] })
    if (!step) {
      return { type: 'SetHeroIntent', intent: null }
    }
    return { type: 'MoveActor', actorId: hero.id, to: step }
  }

  if (intent.kind === 'move-to') {
    if (hero.pos.x === intent.goal.x && hero.pos.y === intent.goal.y) {
      return { type: 'SetHeroIntent', intent: null }
    }
    const step = firstStepToward(state, hero.pos, intent.goal)
    if (!step) {
      return { type: 'SetHeroIntent', intent: null }
    }
    return { type: 'MoveActor', actorId: hero.id, to: step }
  }

  return null
}

function findAdjacentEnemy(state: World, pos: { x: number; y: number }): ActorId | null {
  let best: ActorId | null = null
  let bestHp = Infinity
  for (const id in state.actors) {
    const a = state.actors[id]
    if (a.kind !== 'enemy' || !a.alive) continue
    if (manhattan(a.pos, pos) !== 1) continue
    if (a.hp < bestHp) {
      bestHp = a.hp
      best = id
    }
  }
  return best
}
