import type { World, Action, ActorId } from '../core/types'
import { getArchetype } from '../content/loader'
import { chaseHero } from './behaviors/chase'

/**
 * Returns the action this actor wants to take this turn, or null if it has
 * nothing to do (skip turn). The loop applies its own TurnAdvance per tick;
 * a behavior that wants to "pass" must return null, NEVER TurnAdvance — that
 * would cause the loop to advance twice and skip the next actor.
 */
export function decide(state: World, actorId: ActorId): Action | null {
  const actor = state.actors[actorId]
  if (!actor || !actor.alive) return null
  if (actor.kind === 'hero') return null
  if (actor.kind === 'npc') return null
  const def = getArchetype(actor.archetype)
  switch (def.behavior ?? 'chase') {
    case 'chase': return chaseHero(state, actorId)
    default: return null
  }
}
