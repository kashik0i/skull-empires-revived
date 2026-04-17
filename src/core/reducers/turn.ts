import type { Actor, ActorId, World } from '../types'

export function turnAdvance(state: World): World {
  const len = state.turnOrder.length
  if (len === 0) return state
  let idx = state.turnIndex
  for (let i = 0; i < len; i++) {
    idx = (idx + 1) % len
    const actor = state.actors[state.turnOrder[idx]]
    if (actor && actor.alive) break
  }

  const nextActors: Record<ActorId, Actor> = {}
  for (const id of Object.keys(state.actors)) {
    const actor = state.actors[id]
    const decremented = actor.statusEffects
      .map((e) => ({ ...e, remainingTicks: e.remainingTicks - 1 }))
      .filter((e) => e.remainingTicks > 0)
    nextActors[id] = { ...actor, statusEffects: decremented }
  }

  return { ...state, actors: nextActors, turnIndex: idx, tick: state.tick + 1 }
}
