import type { Action, World } from '../types'
import { moveActor } from './move'

export function rootReducer(state: World, action: Action): World {
  switch (action.type) {
    case 'MoveActor': return moveActor(state, action)
    default: return state
  }
}
