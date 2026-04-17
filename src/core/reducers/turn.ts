import type { World } from '../types'

export function turnAdvance(state: World): World {
  const len = state.turnOrder.length
  if (len === 0) return state
  let idx = state.turnIndex
  for (let i = 0; i < len; i++) {
    idx = (idx + 1) % len
    const actor = state.actors[state.turnOrder[idx]]
    if (actor && actor.alive) break
  }
  return { ...state, turnIndex: idx, tick: state.tick + 1 }
}
