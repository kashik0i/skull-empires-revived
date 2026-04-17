import { createInitialWorld } from '../core/state'
import { dispatch } from '../core/dispatch'
import type { Action, World } from '../core/types'

export function replay(seed: string, log: readonly Action[]): World {
  let state = createInitialWorld(seed)
  for (const action of log) state = dispatch(state, action)
  return state
}
