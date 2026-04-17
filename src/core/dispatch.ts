import type { Action, World } from './types'
import { rootReducer } from './reducers'
import { appendLog } from './log'

export function dispatch(state: World, action: Action): World {
  const next = rootReducer(state, action)
  if (next === state) return state
  const text = describeAction(action, next)
  const withLog = { ...next, log: appendLog(next.log, { tick: next.tick, text }) }
  return withLog
}

function describeAction(action: Action, state: World): string {
  switch (action.type) {
    case 'MoveActor': {
      const actor = state.actors[action.actorId]
      return `${actor?.archetype ?? action.actorId} moves to (${action.to.x},${action.to.y})`
    }
    case 'AttackActor': {
      const a = state.actors[action.attackerId]
      const t = state.actors[action.targetId]
      return `${a?.archetype ?? action.attackerId} attacks ${t?.archetype ?? action.targetId}`
    }
    case 'TurnAdvance': return `turn advance (tick ${state.tick})`
    case 'RunEnd': return `run ended: ${action.outcome}`
    case 'Restart': return `restart with seed ${action.seed}`
  }
}
