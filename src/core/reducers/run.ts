import type { World, Action } from '../types'
import { createInitialWorld } from '../state'

export function runEnd(state: World, action: Extract<Action, { type: 'RunEnd' }>): World {
  return { ...state, phase: action.outcome === 'won' ? 'run_won' : 'run_lost' }
}

export function restart(_state: World, action: Extract<Action, { type: 'Restart' }>): World {
  return createInitialWorld(action.seed)
}
