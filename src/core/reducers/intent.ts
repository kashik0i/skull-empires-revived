import type { World, Action } from '../types'

export function setHeroIntent(state: World, action: Extract<Action, { type: 'SetHeroIntent' }>): World {
  if (state.heroIntent === action.intent) return state
  return { ...state, heroIntent: action.intent }
}
