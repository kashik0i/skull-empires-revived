import type { World, Action } from '../types'

type OpenMerchantAction = Extract<Action, { type: 'OpenMerchantDialog' }>
type MerchantTradeAction = Extract<Action, { type: 'MerchantTrade' }>
type ResolveShrineAction = Extract<Action, { type: 'ResolveShrine' }>

export function clearDialog(state: World): World {
  if (state.pendingDialog === null) return state
  return { ...state, pendingDialog: null }
}

// Stubs filled in by Wave 3 tasks (T8 for merchant, T10 for shrine).
export function openMerchantDialog(state: World, _action: OpenMerchantAction): World {
  return state
}

export function merchantTrade(state: World, _action: MerchantTradeAction): World {
  return state
}

export function resolveShrine(state: World, _action: ResolveShrineAction): World {
  return state
}
