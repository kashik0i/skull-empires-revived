import type { Action, World } from '../types'
import { moveActor } from './move'
import { attackActor } from './attack'
import { turnAdvance } from './turn'

export function rootReducer(state: World, action: Action): World {
  switch (action.type) {
    case 'MoveActor': return moveActor(state, action)
    case 'AttackActor': return attackActor(state, action)
    case 'TurnAdvance': return turnAdvance(state)
    default: return state
  }
}
