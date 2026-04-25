import type { World, Action, ActorId } from '../../core/types'
import { firstStepToward, manhattan } from '../pathfind'

/**
 * Enemies "see" the hero when a real BFS path of at most CHASE_RANGE steps
 * exists. Beyond that they idle — keeps far-room enemies from twitching
 * against walls and limits per-tick BFS cost to a small bounded region.
 */
const CHASE_RANGE = 12

export function chaseHero(state: World, actorId: ActorId): Action {
  const actor = state.actors[actorId]
  const hero = state.actors[state.heroId]
  if (!actor || !actor.alive || !hero || !hero.alive) return { type: 'TurnAdvance' }
  if (manhattan(actor.pos, hero.pos) === 1) {
    return { type: 'AttackActor', attackerId: actorId, targetId: state.heroId }
  }
  // Manhattan is a lower bound on BFS, so this is a free pre-filter for
  // obviously-out-of-range enemies before we pay for the BFS itself.
  if (manhattan(actor.pos, hero.pos) > CHASE_RANGE) return { type: 'TurnAdvance' }
  const step = firstStepToward(state, actor.pos, hero.pos, { maxDepth: CHASE_RANGE })
  if (!step) return { type: 'TurnAdvance' }
  return { type: 'MoveActor', actorId, to: step }
}
