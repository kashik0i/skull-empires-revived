import type { World, Action } from '../types'

export function setHeroIntent(state: World, action: Extract<Action, { type: 'SetHeroIntent' }>): World {
  // A new intent always invalidates the cached path — the old path was for a different goal.
  if (state.heroIntent === action.intent && state.heroPath.length === 0) return state
  return { ...state, heroIntent: action.intent, heroPath: [] }
}

export function setHeroPath(state: World, action: Extract<Action, { type: 'SetHeroPath' }>): World {
  return { ...state, heroPath: action.path }
}
