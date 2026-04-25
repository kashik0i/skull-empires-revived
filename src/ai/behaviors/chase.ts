import type { World, Action, ActorId } from '../../core/types'
import { firstStepToward, manhattan } from '../pathfind'

/**
 * Enemies "see" the hero when a real BFS path of at most CHASE_RANGE steps
 * exists. Beyond that they idle. Tuned low (6) on purpose: BFS-correct
 * chase pathing is much more capable than the old greedy heuristic, so a
 * larger radius makes every enemy within line-of-corridor swarm the hero
 * — fine for combat, but it shuts down general traversal across a floor.
 */
const CHASE_RANGE = 6

export function chaseHero(state: World, actorId: ActorId): Action | null {
  const actor = state.actors[actorId]
  const hero = state.actors[state.heroId]
  if (!actor || !actor.alive || !hero || !hero.alive) return null
  if (manhattan(actor.pos, hero.pos) === 1) {
    return { type: 'AttackActor', attackerId: actorId, targetId: state.heroId }
  }
  // Manhattan is a lower bound on BFS, so this is a free pre-filter for
  // obviously-out-of-range enemies before we pay for the BFS itself.
  if (manhattan(actor.pos, hero.pos) > CHASE_RANGE) return null
  const step = firstStepToward(state, actor.pos, hero.pos, { maxDepth: CHASE_RANGE })
  if (!step) return null
  return { type: 'MoveActor', actorId, to: step }
}
