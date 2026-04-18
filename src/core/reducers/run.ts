import type { World, Action } from '../types'
import { createInitialWorld } from '../state'
import { instantiateItem } from '../../content/itemLoader'
import { nextU32 } from '../rng'

export function runEnd(state: World, action: Extract<Action, { type: 'RunEnd' }>): World {
  return { ...state, phase: action.outcome === 'won' ? 'run_won' : 'run_lost' }
}

export function restart(_state: World, action: Extract<Action, { type: 'Restart' }>): World {
  return createInitialWorld(action.seed)
}

export function offerItemReward(state: World, action: Extract<Action, { type: 'OfferItemReward' }>): World {
  return { ...state, run: { ...state.run, pendingItemReward: action.itemIds } }
}

export function pickItemReward(state: World, action: Extract<Action, { type: 'PickItemReward' }>): World {
  if (!state.run.pendingItemReward?.includes(action.itemId)) return state
  if (state.inventory.length >= 6) {
    return { ...state, run: { ...state.run, pendingItemReward: null, rewardedThisFloor: true } }
  }
  const r = nextU32(state.rng)
  const item = instantiateItem(action.itemId, `reward-${state.tick}-${r.value}`)
  return {
    ...state,
    rng: r.state,
    inventory: [...state.inventory, item],
    run: { ...state.run, pendingItemReward: null, rewardedThisFloor: true },
  }
}
