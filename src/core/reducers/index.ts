import type { Action, World } from '../types'
import { moveActor } from './move'
import { attackActor } from './attack'
import { turnAdvance } from './turn'
import { runEnd, restart, offerItemReward, pickItemReward } from './run'
import { setHeroIntent, setHeroPath } from './intent'
import { descend } from './descend'
import { playCard, offerCardReward, pickCardReward } from './card'
import { clearDialog, openMerchantDialog, merchantBuyItem, resolveShrine } from './dialog'
import { useItem, equipItem, unequipItem, pickupItem } from './inventory'

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
    case 'MerchantBuyItem': return merchantBuyItem(state, action)
    case 'ResolveShrine': return resolveShrine(state, action)
    case 'UseItem': return useItem(state, action)
    case 'EquipItem': return equipItem(state, action)
    case 'UnequipItem': return unequipItem(state, action)
    case 'PickupItem': return pickupItem(state, action)
    case 'OfferItemReward': return offerItemReward(state, action)
    case 'PickItemReward': return pickItemReward(state, action)
    default: return state
  }
}
