import type { Action, World } from '../types'
import { moveActor } from './move'
import { attackActor } from './attack'
import { turnAdvance } from './turn'
import { runEnd, restart } from './run'
import { setHeroIntent, setHeroPath } from './intent'
import { descend } from './descend'
import { playCard, offerCardReward, pickCardReward } from './card'
import { clearDialog, openMerchantDialog, merchantTrade, resolveShrine } from './dialog'

export function rootReducer(state: World, action: Action): World {
  switch (action.type) {
    case 'MoveActor': return moveActor(state, action)
    case 'AttackActor': return attackActor(state, action)
    case 'TurnAdvance': return turnAdvance(state)
    case 'RunEnd': return runEnd(state, action)
    case 'Restart': return restart(state, action)
    case 'SetHeroIntent': return setHeroIntent(state, action)
    case 'SetHeroPath': return setHeroPath(state, action)
    case 'Descend': return descend(state)
    case 'PlayCard': return playCard(state, action)
    case 'OfferCardReward': return offerCardReward(state, action)
    case 'PickCardReward': return pickCardReward(state, action)
    case 'ClearDialog': return clearDialog(state)
    case 'OpenMerchantDialog': return openMerchantDialog(state, action)
    case 'MerchantTrade': return merchantTrade(state, action)
    case 'ResolveShrine': return resolveShrine(state, action)
    default: return state
  }
}
