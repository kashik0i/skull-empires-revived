import type { World, Action, ActorId } from '../core/types'
import { getArchetype } from '../content/loader'
import { chaseHero } from './behaviors/chase'

export function decide(state: World, actorId: ActorId): Action {
  const actor = state.actors[actorId]
  if (!actor || !actor.alive) return { type: 'TurnAdvance' }
  if (actor.kind === 'hero') return { type: 'TurnAdvance' }
  const def = getArchetype(actor.archetype)
  switch (def.behavior ?? 'chase') {
    case 'chase': return chaseHero(state, actorId)
    default: return { type: 'TurnAdvance' }
  }
}
